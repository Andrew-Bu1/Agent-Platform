// Mirrors src/models/model_config.py :: ModelConfig

export interface ModelConfig {
  id: string
  name: string
  task_type: string
  provider: string
  endpoint_url: string | null
  input_cost: string | null   // Decimal serialized as string
  output_cost: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ModelConfigCreate {
  name: string
  task_type: string
  provider: string
  endpoint_url?: string | null
  input_cost?: string | null
  output_cost?: string | null
}

export interface ModelConfigUpdate {
  name?: string | null
  task_type?: string | null
  provider?: string | null
  endpoint_url?: string | null
  input_cost?: string | null
  output_cost?: string | null
  is_active?: boolean | null
}
