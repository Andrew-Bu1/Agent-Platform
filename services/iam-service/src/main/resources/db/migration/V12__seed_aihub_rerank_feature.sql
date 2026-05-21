-- V12: Seed missing aihub.rerank feature.
--
-- The AIHub /v1/rerank endpoint gates on FeatureGuard.require("aihub.rerank"),
-- but this feature key was never inserted into the features table (V10 seeded
-- aihub.chat and aihub.embedding but omitted aihub.rerank).
-- Without this row, IAM's /entitlements/features will never return the key,
-- so every rerank call returns 403 regardless of tenant entitlements.

INSERT INTO features (id, key, name, description, created_at) VALUES
    ('00000000-0000-0000-0010-000000000009', 'aihub.rerank',
     'AIHub Rerank',
     'Rerank candidate passages by relevance score via AIHub.',
     NOW())
ON CONFLICT (key) DO NOTHING;
