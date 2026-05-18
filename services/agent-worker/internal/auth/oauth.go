package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// OAuthTokenProvider obtains and caches IAM client_credentials access tokens.
type OAuthTokenProvider struct {
	iamURL       string
	clientID     string
	clientSecret string
	httpClient   *http.Client

	mu        sync.Mutex
	token     string
	expiresAt time.Time
}

func NewOAuthTokenProvider(iamURL, clientID, clientSecret string) *OAuthTokenProvider {
	return &OAuthTokenProvider{
		iamURL:       strings.TrimRight(iamURL, "/"),
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *OAuthTokenProvider) Enabled() bool {
	return p != nil && p.iamURL != "" && p.clientID != "" && p.clientSecret != ""
}

func (p *OAuthTokenProvider) Token(ctx context.Context) (string, error) {
	if !p.Enabled() {
		return "", errors.New("IAM OAuth client credentials are not configured")
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.token != "" && time.Now().Before(p.expiresAt.Add(-30*time.Second)) {
		return p.token, nil
	}

	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", p.clientID)
	form.Set("client_secret", p.clientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		p.iamURL+"/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("POST /oauth/token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("oauth token status %d: %s", resp.StatusCode, b)
	}

	var body struct {
		AccessToken    string `json:"accessToken"`
		AccessTokenAlt string `json:"access_token"`
		ExpiresIn      int    `json:"expiresIn"`
		ExpiresInAlt   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("decode oauth token response: %w", err)
	}

	token := body.AccessToken
	if token == "" {
		token = body.AccessTokenAlt
	}
	if token == "" {
		return "", errors.New("oauth token response missing access token")
	}

	expiresIn := body.ExpiresIn
	if expiresIn == 0 {
		expiresIn = body.ExpiresInAlt
	}
	if expiresIn <= 0 {
		expiresIn = 3600
	}

	p.token = token
	p.expiresAt = time.Now().Add(time.Duration(expiresIn) * time.Second)
	return p.token, nil
}
