// Package featuregate checks tenant feature entitlements against IAM.
//
// It caches enabled feature keys per tenant for 5 minutes so that feature
// checks do not add a round-trip on every request.
package featuregate

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

const ttl = 5 * time.Minute

type cacheEntry struct {
	fetchedAt time.Time
	keys      map[string]struct{}
}

// Gate fetches and caches feature entitlements from IAM.
type Gate struct {
	iamBaseURL string
	client     *http.Client

	mu    sync.Mutex
	store map[string]cacheEntry // key: tenant_id
}

// New creates a Gate that calls iamBaseURL/entitlements/features.
func New(iamBaseURL string) *Gate {
	return &Gate{
		iamBaseURL: iamBaseURL,
		client:     &http.Client{Timeout: 5 * time.Second},
		store:      make(map[string]cacheEntry),
	}
}

// Check returns nil when the tenant has featureKey enabled, or an error otherwise.
// bearerToken is the caller's JWT — forwarded to IAM to identify the tenant.
func (g *Gate) Check(ctx context.Context, tenantID uuid.UUID, bearerToken, featureKey string) error {
	keys, err := g.enabledKeys(ctx, tenantID, bearerToken)
	if err != nil {
		// Fail open: if IAM is unreachable, do not block the request.
		return nil
	}
	if _, ok := keys[featureKey]; !ok {
		return fmt.Errorf("feature not enabled for this tenant: %s", featureKey)
	}
	return nil
}

func (g *Gate) enabledKeys(ctx context.Context, tenantID uuid.UUID, bearerToken string) (map[string]struct{}, error) {
	tid := tenantID.String()

	g.mu.Lock()
	entry, hit := g.store[tid]
	g.mu.Unlock()

	if hit && time.Since(entry.fetchedAt) < ttl {
		return entry.keys, nil
	}

	keys, err := g.fetch(ctx, bearerToken)
	if err != nil {
		return nil, err
	}

	g.mu.Lock()
	g.store[tid] = cacheEntry{fetchedAt: time.Now(), keys: keys}
	g.mu.Unlock()

	return keys, nil
}

type featureView struct {
	FeatureKey string `json:"featureKey"`
	Enabled    bool   `json:"enabled"`
}

type apiResponse struct {
	Data []featureView `json:"data"`
}

func (g *Gate) fetch(ctx context.Context, bearerToken string) (map[string]struct{}, error) {
	url := g.iamBaseURL + "/entitlements/features"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+bearerToken)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("IAM returned status %d", resp.StatusCode)
	}

	var body apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}

	keys := make(map[string]struct{}, len(body.Data))
	for _, f := range body.Data {
		if f.Enabled {
			keys[f.FeatureKey] = struct{}{}
		}
	}
	return keys, nil
}
