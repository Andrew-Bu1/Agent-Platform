CREATE TABLE IF NOT EXISTS model_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(255) NOT NULL UNIQUE,
    task_type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,

    storage_uri TEXT,

    input_cost_per_1k_tokens  DECIMAL(12,6),
    output_cost_per_1k_tokens DECIMAL(12,6),

    default_params JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE

);

CREATE TABLE IF NOT EXISTS model_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL REFERENCES model_configs(model_id),

    input_tokens INT,
    output_tokens INT,
    total_tokens INT,
    
    total_cost DECIMAL(12,6),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

