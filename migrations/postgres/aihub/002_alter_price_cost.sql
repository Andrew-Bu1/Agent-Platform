ALTER TABLE model_configs
ALTER COLUMN input_cost TYPE NUMERIC(18, 10);

ALTER TABLE model_configs
ALTER COLUMN output_cost TYPE NUMERIC(18, 10);


ALTER TABLE model_usage_logs
ALTER COLUMN cost TYPE NUMERIC(18, 10);