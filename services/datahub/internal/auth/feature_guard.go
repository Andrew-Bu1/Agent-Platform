package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

const featureCacheTTL = 5 * time.Minute

type featureCacheEntry struct {
	features  map[string]struct{}
	fetchedAt time.Time
}

// FeatureGuard checks tenant feature entitlements via IAM.
// Results are cached per tenant for 5 minutes.
// On IAM errors the guard fails open (allows the request) to preserve availability.
type FeatureGuard struct {
	iamURL string
	client *http.Client
	mu     sync.Mutex
	cache  map[uuid.UUID]*featureCacheEntry
}

func NewFeatureGuard(iamURL string) *FeatureGuard {
	return &FeatureGuard{
		iamURL: iamURL,
		client: &http.Client{Timeout: 5 * time.Second},
		cache:  make(map[uuid.UUID]*featureCacheEntry),
	}
}

// Require returns an error if the given feature is not enabled for the tenant.
// bearerToken must NOT include the "Bearer " prefix.
func (g *FeatureGuard) Require(ctx context.Context, bearerToken string, tenantID uuid.UUID, feature string) error {
	features, err := g.getFeatures(ctx, bearerToken, tenantID)
	if err != nil {
		// Fail open: do not block requests when IAM is unreachable.
		return nil
	}
	if _, ok := features[feature]; !ok {
		return fmt.Errorf("feature not enabled: %s", feature)
	}
	return nil
}

func (g *FeatureGuard) getFeatures(ctx context.Context, bearerToken string, tenantID uuid.UUID) (map[string]struct{}, error) {
	g.mu.Lock()
	entry := g.cache[tenantID]
	if entry != nil && time.Since(entry.fetchedAt) < featureCacheTTL {
		g.mu.Unlock()
		return entry.features, nil
	}
	g.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.iamURL+"/entitlements/features", nil)
	if err != nil {
		return nil, fmt.Errorf("feature check: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+bearerToken)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("feature check: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("feature check: IAM returned status %d", resp.StatusCode)
	}

	var body struct {
		Data []struct {
			FeatureKey string `json:"featureKey"`
			Enabled    bool   `json:"enabled"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("feature check: decode response: %w", err)
	}

	features := make(map[string]struct{}, len(body.Data))
	for _, f := range body.Data {
		if f.Enabled {
			features[f.FeatureKey] = struct{}{}
		}
	}

	g.mu.Lock()
	g.cache[tenantID] = &featureCacheEntry{features: features, fetchedAt: time.Now()}
	g.mu.Unlock()

	return features, nil
}
