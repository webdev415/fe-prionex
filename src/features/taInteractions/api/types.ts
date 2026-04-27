export interface TAInteraction {
  id: number
  client_id: number
  credit_id: number | null
  chain_id: number
  chain_name: string | null
  chain_instance_id: number | null
  leaf_node_id: number | null
  leaf_node_name: string | null
  dropdown_value_id: number | null
  dropdown_value_name: string | null
  dictionary_path: string[]
  promise_date: string | null
  promise_amount: string | null
  notes: string | null
  step_data: Record<string, unknown> | null
  recorded_by: number | null
  recorded_by_name: string | null
  call_id: number | null
  assigned_operator_id: number | null
  created_at: string
  archived: boolean
}

export interface TAInteractionListResponse {
  total: number
  total_count: number
  items: TAInteraction[]
}

export interface TAInteractionListParams {
  client_id?: number
  chain_id?: number
  recorded_by?: number
  leaf_node_id?: number
  date_from?: string
  date_to?: string
  notes_search?: string
  skip?: number
  limit?: number
}

export interface TAInteractionUpdate {
  credit_id?: number | null
  promise_date?: string | null
  promise_amount?: number | null
  notes?: string | null
  step_data?: Record<string, unknown> | null
  clear_credit_id?: boolean
  clear_promise_date?: boolean
  clear_promise_amount?: boolean
}

export interface TAInteractionCreate {
  client_id: number
  credit_id?: number | null
  chain_id: number
  chain_instance_id?: number | null
  leaf_node_id?: number | null
  dropdown_value_id?: number | null
  promise_date?: string | null
  promise_amount?: number | null
  notes?: string | null
  step_data?: Record<string, unknown> | null
  call_id?: number | null
  assigned_operator_id?: number | null
}

export interface ChainInstance {
  id: number
  chain_id: number
  chain_name: string | null
  client_id: number
  status: 'active' | 'completed' | 'cancelled'
  current_step_order: number | null
  started_by: number | null
  started_at: string
  completed_at: string | null
  last_step_completed_at: string | null
  delay_seconds_left: number
}

export interface ChainInstanceCreate {
  chain_id: number
  client_id: number
}
