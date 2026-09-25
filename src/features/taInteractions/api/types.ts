import type { TagDefinition } from '@/features/tags/types'

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
  recorded_by_full_name: string | null
  call_id: number | null
  // Snapshot of the client's responsible employee at the moment the
  // interaction was created. Field name is historical; semantic is now
  // "Responsible at creation" in the TA History tab.
  assigned_operator_id: number | null
  assigned_operator_name: string | null
  // Live `clients.responsible_employee_id` resolved at query time — who
  // owns the client right now. Populated only by the TA History list
  // handler; null on other endpoints.
  current_responsible_id: number | null
  current_responsible_name: string | null
  created_at: string
  archived: boolean
  is_pinned: boolean
  pinned_at: string | null
  // KAN-1110 — when this record's author stops being able to edit/delete it
  // without the separate permission. Server-computed (`created_at` + 5 min) so
  // the countdown cannot drift from the API guard.
  // Nullable on purpose: TAInteraction is shared by the list, create, update,
  // InteractionLog and Training endpoints, and only the TA-history handler is
  // known to populate this. Declaring it required would assert every endpoint
  // returns it — and would let a frontend deployed ahead of the backend
  // type-check cleanly and then degrade silently at runtime. parseUtcTimestamp
  // already accepts null/undefined; this makes the types agree with it.
  self_edit_expires_at: string | null
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
  recorded_by_in?: number[]
  assigned_operator_id?: number
  target_action_id_in?: number[]
  // Each item is "<target_action_id>:<value>"
  step_value_eq?: string[]
  step_value_min?: string[]
  step_value_max?: string[]
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
  // Values of steps the operator explicitly edited in the fill-in modal after
  // confirming them (keyed by step_order). The backend mirrors ONLY these into
  // the chain-instance snapshot so the completion reconciliation (KAN-744)
  // preserves the edit instead of overwriting it with the pre-edit value.
  edited_step_data?: Record<string, string> | null
  call_id?: number | null
  assigned_operator_id?: number | null
  notify_responsible?: boolean
}

export interface ChainInstanceStepSnapshot {
  value?: string | null
  dropdown_value_id?: number | null
  dropdown_value_name?: string | null
  leaf_node_id?: number | null
  promise_date?: string | null
  promise_amount?: string | null
  credit_id?: string | null
  target_action_id?: number | null
  target_action_name?: string | null
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
  step_data: Record<string, ChainInstanceStepSnapshot> | null
  /** Authoritative tag list after chain completion (same shape as GET /clients/:id/tags). */
  client_tags?: TagDefinition[] | null
}

export interface ChainInstanceCreate {
  chain_id: number
  client_id: number
}
