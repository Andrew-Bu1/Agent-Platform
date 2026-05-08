-- Index for direct session lookup by token hash (used during token refresh and logout).
-- Only active (non-revoked) sessions need to be queried this way.
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash
    ON user_sessions (session_token_hash)
    WHERE revoked_at IS NULL;
