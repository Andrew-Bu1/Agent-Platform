-- V4: Expand tool_type constraint to allow 'code' and 'custom' types.
ALTER TABLE tools DROP CONSTRAINT IF EXISTS chk_tools_tool_type;
ALTER TABLE tools ADD CONSTRAINT chk_tools_tool_type
    CHECK (tool_type IN (
        'http', 'function', 'database', 'webhook', 'email', 'internal_service',
        'code', 'custom'
    ));
