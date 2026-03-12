CREATE TABLE IF NOT EXISTS model_configs (
    id UUID PRIMARY KEY,

    name VARCHAR(255) UNIQUE NOT NULL,
    task_type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,

    endpoint_url TEXT,

    input_cost  NUMERIC(12,6),
    output_cost NUMERIC(12,6),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS model_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES model_configs(id),

    input_tokens INT,
    output_tokens INT,
    
    cost NUMERIC(12,6),

    status VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);