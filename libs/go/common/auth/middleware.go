package auth

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type contextKey string

const (
	tenantIDKey    contextKey = "tenant_id"
	workspaceIDKey contextKey = "workspace_id"
	subjectKey     contextKey = "subject"
	callerTypeKey  contextKey = "caller_type"
)

// Options configures the IAM JWT middleware.
type Options struct {
	// JWKSURL points at IAM's public key set endpoint.
	JWKSURL string

	// TrustedHeaders keeps compatibility for deployments that terminate auth at
	// a gateway and forward X-Tenant-ID/X-Workspace-ID. It is disabled by default.
	TrustedHeaders bool

	// Issuer is the expected value of the JWT iss claim. Empty disables the check.
	Issuer string

	// Audience is the expected audience entry in the JWT aud claim. Empty disables the check.
	Audience string
}

// Middleware verifies an IAM-issued Bearer JWT and injects tenant/workspace
// identifiers into the request context. Set AUTH_TRUSTED_HEADERS=true only when
// a trusted gateway has already verified the JWT and strips spoofed headers.
//
// Environment:
//   - IAM_JWKS_URL: full JWKS endpoint URL
//   - IAM_URL or IAM_BASE_URL: IAM base URL used to build /.well-known/jwks.json
//   - AUTH_TRUSTED_HEADERS=true: opt into legacy X-Tenant-ID/X-Workspace-ID mode
//
// Paths listed in exemptPaths are allowed through without headers.
func Middleware(next http.Handler, exemptPaths ...string) http.Handler {
	return NewMiddleware(next, Options{
		JWKSURL:        jwksURLFromEnv(),
		TrustedHeaders: strings.EqualFold(os.Getenv("AUTH_TRUSTED_HEADERS"), "true"),
		Issuer:         os.Getenv("JWT_ISSUER"),
		Audience:       os.Getenv("JWT_AUDIENCE"),
	}, exemptPaths...)
}

// NewMiddleware is the testable constructor for the auth middleware.
func NewMiddleware(next http.Handler, opts Options, exemptPaths ...string) http.Handler {
	exempt := make(map[string]struct{}, len(exemptPaths))
	for _, p := range exemptPaths {
		exempt[p] = struct{}{}
	}

	verifier := newJWTVerifier(opts.JWKSURL)
	verifier.issuer = opts.Issuer
	verifier.audience = opts.Audience

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := exempt[r.URL.Path]; ok {
			next.ServeHTTP(w, r)
			return
		}

		if opts.TrustedHeaders {
			ctx, ok := contextFromTrustedHeaders(w, r)
			if !ok {
				return
			}
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		claims, err := verifier.verifyRequest(r)
		if err != nil {
			writeAuthError(w, http.StatusUnauthorized, err.Error())
			return
		}

		callerType := stringClaim(claims, "type")
		tenantIDStr := stringClaim(claims, "tenant_id")
		workspaceIDStr := stringClaim(claims, "workspace_id")

		if tenantIDStr == "" {
			writeAuthError(w, http.StatusUnauthorized, "token missing tenant_id claim")
			return
		}
		// service_client tokens are tenant-scoped but don't carry a workspace_id.
		// All other token types must include one.
		if callerType != "service_client" && workspaceIDStr == "" {
			writeAuthError(w, http.StatusUnauthorized, "token missing workspace_id claim")
			return
		}

		tenantID, err := uuid.Parse(tenantIDStr)
		if err != nil {
			writeAuthError(w, http.StatusBadRequest, "invalid tenant_id claim")
			return
		}

		var workspaceID uuid.UUID
		if workspaceIDStr != "" {
			workspaceID, err = uuid.Parse(workspaceIDStr)
			if err != nil {
				writeAuthError(w, http.StatusBadRequest, "invalid workspace_id claim")
				return
			}
		}

		ctx := context.WithValue(r.Context(), tenantIDKey, tenantID)
		ctx = context.WithValue(ctx, workspaceIDKey, workspaceID)
		ctx = context.WithValue(ctx, subjectKey, stringClaim(claims, "sub"))
		ctx = context.WithValue(ctx, callerTypeKey, callerType)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func contextFromTrustedHeaders(w http.ResponseWriter, r *http.Request) (context.Context, bool) {
	tenantIDStr := r.Header.Get("X-Tenant-ID")
	workspaceIDStr := r.Header.Get("X-Workspace-ID")

	if tenantIDStr == "" || workspaceIDStr == "" {
		writeAuthError(w, http.StatusUnauthorized, "missing X-Tenant-ID or X-Workspace-ID header")
		return nil, false
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid X-Tenant-ID")
		return nil, false
	}

	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid X-Workspace-ID")
		return nil, false
	}

	ctx := context.WithValue(r.Context(), tenantIDKey, tenantID)
	ctx = context.WithValue(ctx, workspaceIDKey, workspaceID)
	return ctx, true
}

// minJWKSRefreshInterval caps how often we hit IAM's JWKS endpoint to prevent
// DoS via tokens with random unknown kids.
const minJWKSRefreshInterval = 60 * time.Second

type jwtVerifier struct {
	jwksURL  string
	issuer   string
	audience string
	client   *http.Client

	mu   sync.RWMutex
	keys map[string]*rsa.PublicKey

	// loadMu serializes concurrent refresh attempts; lastFetch is only
	// accessed while loadMu is held.
	loadMu    sync.Mutex
	lastFetch time.Time
}

func newJWTVerifier(jwksURL string) *jwtVerifier {
	return &jwtVerifier{
		jwksURL: jwksURL,
		client:  &http.Client{Timeout: 10 * time.Second},
		keys:    map[string]*rsa.PublicKey{},
	}
}

func (v *jwtVerifier) verifyRequest(r *http.Request) (map[string]any, error) {
	header := r.Header.Get("Authorization")
	if header == "" || !strings.HasPrefix(header, "Bearer ") {
		return nil, errors.New("missing Bearer token")
	}
	return v.verify(r.Context(), strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")))
}

func (v *jwtVerifier) verify(ctx context.Context, token string) (map[string]any, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("malformed JWT")
	}

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	headerBytes, err := decodeSegment(parts[0])
	if err != nil {
		return nil, errors.New("malformed JWT header")
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, errors.New("malformed JWT header")
	}
	if header.Alg != "RS256" {
		return nil, errors.New("unsupported JWT algorithm")
	}
	if header.Kid == "" {
		return nil, errors.New("token missing key ID")
	}

	publicKey, err := v.key(ctx, header.Kid)
	if err != nil {
		return nil, err
	}

	signature, err := decodeSegment(parts[2])
	if err != nil {
		return nil, errors.New("malformed JWT signature")
	}

	signed := parts[0] + "." + parts[1]
	digest := sha256.Sum256([]byte(signed))
	if err := rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, digest[:], signature); err != nil {
		return nil, errors.New("JWT signature verification failed")
	}

	payloadBytes, err := decodeSegment(parts[1])
	if err != nil {
		return nil, errors.New("malformed JWT payload")
	}

	decoder := json.NewDecoder(bytes.NewReader(payloadBytes))
	decoder.UseNumber()
	var claims map[string]any
	if err := decoder.Decode(&claims); err != nil {
		return nil, errors.New("malformed JWT claims")
	}

	if err := validateClaims(claims, v.issuer, v.audience); err != nil {
		return nil, err
	}
	return claims, nil
}

func (v *jwtVerifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	key := v.keys[kid]
	v.mu.RUnlock()
	if key != nil {
		return key, nil
	}

	// Serialize refresh attempts so only one goroutine hits IAM at a time.
	v.loadMu.Lock()
	defer v.loadMu.Unlock()

	// Double-check: another goroutine may have fetched while we waited.
	v.mu.RLock()
	key = v.keys[kid]
	v.mu.RUnlock()
	if key != nil {
		return key, nil
	}

	// Rate-limit: reject unknown kids if we just fetched — prevents DoS via
	// tokens with random kids hammering the IAM JWKS endpoint.
	if time.Since(v.lastFetch) < minJWKSRefreshInterval {
		return nil, errors.New("unknown signing key")
	}

	if err := v.load(ctx); err != nil {
		return nil, err
	}

	v.mu.RLock()
	key = v.keys[kid]
	v.mu.RUnlock()
	if key == nil {
		return nil, errors.New("unknown signing key")
	}
	return key, nil
}

func (v *jwtVerifier) load(ctx context.Context) error {
	if v.jwksURL == "" {
		return errors.New("IAM JWKS URL is not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return fmt.Errorf("invalid IAM JWKS URL: %w", err)
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch IAM JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch IAM JWKS: status %d", resp.StatusCode)
	}

	var body struct {
		Keys []jwkKey `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return fmt.Errorf("decode IAM JWKS: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey, len(body.Keys))
	for _, jwk := range body.Keys {
		if jwk.Kty != "RSA" || jwk.Kid == "" {
			continue
		}
		key, err := jwk.rsaPublicKey()
		if err != nil {
			continue
		}
		keys[jwk.Kid] = key
	}

	v.mu.Lock()
	v.keys = keys
	v.mu.Unlock()
	v.lastFetch = time.Now()
	return nil
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func (k jwkKey) rsaPublicKey() (*rsa.PublicKey, error) {
	modulus, err := decodeSegment(k.N)
	if err != nil {
		return nil, err
	}
	exponentBytes, err := decodeSegment(k.E)
	if err != nil {
		return nil, err
	}
	exponent := new(big.Int).SetBytes(exponentBytes).Int64()
	if exponent <= 0 || exponent > int64(^uint(0)>>1) {
		return nil, errors.New("invalid RSA exponent")
	}
	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(modulus),
		E: int(exponent),
	}, nil
}

func validateClaims(claims map[string]any, issuer, audience string) error {
	if stringClaim(claims, "token_type") != "access" {
		return errors.New("invalid token type")
	}
	exp, ok := numberClaim(claims, "exp")
	if !ok {
		return errors.New("token missing expiration")
	}
	if time.Now().Unix() >= exp {
		return errors.New("token expired")
	}
	if issuer != "" && stringClaim(claims, "iss") != issuer {
		return errors.New("invalid token issuer")
	}
	if audience != "" && !claimContainsAudience(claims, audience) {
		return errors.New("token not valid for this audience")
	}
	return nil
}

func claimContainsAudience(claims map[string]any, want string) bool {
	raw, ok := claims["aud"]
	if !ok || raw == nil {
		return false
	}
	switch v := raw.(type) {
	case string:
		return v == want
	case []interface{}:
		for _, item := range v {
			if s, ok := item.(string); ok && s == want {
				return true
			}
		}
	}
	return false
}

func decodeSegment(segment string) ([]byte, error) {
	if strings.Contains(segment, "=") {
		return base64.URLEncoding.DecodeString(segment)
	}
	return base64.RawURLEncoding.DecodeString(segment)
}

func jwksURLFromEnv() string {
	if value := strings.TrimSpace(os.Getenv("IAM_JWKS_URL")); value != "" {
		return value
	}
	baseURL := strings.TrimSpace(os.Getenv("IAM_URL"))
	if baseURL == "" {
		baseURL = strings.TrimSpace(os.Getenv("IAM_BASE_URL"))
	}
	if baseURL == "" {
		baseURL = "http://iam-service:8080"
	}
	return strings.TrimRight(baseURL, "/") + "/.well-known/jwks.json"
}

func stringClaim(claims map[string]any, name string) string {
	value, ok := claims[name]
	if !ok || value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return s
	}
	return fmt.Sprint(value)
}

func numberClaim(claims map[string]any, name string) (int64, bool) {
	value, ok := claims[name]
	if !ok || value == nil {
		return 0, false
	}
	switch v := value.(type) {
	case json.Number:
		i, err := v.Int64()
		if err == nil {
			return i, true
		}
		f, err := v.Float64()
		if err != nil {
			return 0, false
		}
		return int64(f), true
	case float64:
		return int64(v), true
	case int64:
		return v, true
	default:
		return 0, false
	}
}

func writeAuthError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// TenantID extracts the tenant UUID from ctx. Panics if not present (should
// only be called after Middleware has run).
func TenantID(ctx context.Context) uuid.UUID {
	return ctx.Value(tenantIDKey).(uuid.UUID)
}

// WorkspaceID extracts the workspace UUID from ctx.
// Returns a zero UUID for service_client tokens that are not workspace-scoped.
func WorkspaceID(ctx context.Context) uuid.UUID {
	v := ctx.Value(workspaceIDKey)
	if v == nil {
		return uuid.UUID{}
	}
	return v.(uuid.UUID)
}

// CallerType returns the token's "type" claim: "user" or "service_client".
func CallerType(ctx context.Context) string {
	v := ctx.Value(callerTypeKey)
	if v == nil {
		return ""
	}
	return v.(string)
}

// Subject returns the JWT sub claim (user/service-client ID string).
// Returns an empty string when not present.
func Subject(ctx context.Context) string {
	v := ctx.Value(subjectKey)
	if v == nil {
		return ""
	}
	return v.(string)
}
