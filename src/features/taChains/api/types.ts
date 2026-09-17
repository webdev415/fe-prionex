/**
 * TA Chains (KAN-318) — API types
 */

export type ChainType = 'manual' | 'automatic'

export type ContactSource = 'client' | 'recommender'
export type ContactMedium = 'phone' | 'email'

export interface TAChainStepIn {
  target_action_id: number
  is_required?: boolean
  delay_minutes?: number
  not_in_the_past?: boolean
  contact_source?: ContactSource | null
  contact_medium?: ContactMedium
  // Credit-step admin flag: include debts with status='closed' in the
  // executor's picker (true) or only status='active' (false). Default
  // false. Meaningful only when the step's TA has field_type='credit'.
  show_closed_credits?: boolean
  // KAN-1069: this step's value feeds ta_interactions.promise_date /
  // promise_amount. Valid only on a date / amount step respectively; at most
  // one of each per chain, and the two are a pair — the server refuses a
  // chain carrying one without the other.
  is_promise_date?: boolean
  is_promise_amount?: boolean
}

export interface TAChainStep {
  id: number
  chain_id: number
  target_action_id: number
  target_action_name: string | null
  target_action_field_type: string | null
  step_order: number
  is_required: boolean
  delay_minutes: number
  not_in_the_past: boolean
  contact_source: ContactSource | null
  contact_medium: ContactMedium
  show_closed_credits: boolean
  is_promise_date: boolean
  is_promise_amount: boolean
  position_x: number | null
  position_y: number | null
}

export interface TAChain {
  id: number
  name: string
  description: string | null
  chain_type: ChainType
  department_ids: number[]
  is_active: boolean
  is_system_hidden: boolean
  is_pinned: boolean
  steps: TAChainStep[]
  step_count: number
  created_by: number | null
  created_at: string
  updated_at: string
  // KAN-XXX — chain edit lock. ``is_structurally_locked`` is true when
  // any ta_interactions have been recorded against this chain; the BE
  // refuses ``steps`` / ``chain_type`` changes in that state. The Chain
  // Builder reads it to disable the structural editing UI and surface a
  // "Clone to modify" prompt. Boolean only — no count is fetched, so
  // the lock probe doesn't get more expensive as a chain accumulates
  // history.
  is_structurally_locked?: boolean
}

export interface TAChainListResponse {
  total: number
  items: TAChain[]
}

export interface TAChainCreate {
  name: string
  description?: string
  chain_type: ChainType
  department_ids: number[]
  is_system_hidden?: boolean
  steps?: TAChainStepIn[]
}

export interface TAChainUpdate {
  name?: string
  description?: string
  chain_type?: ChainType
  department_ids?: number[]
  is_system_hidden?: boolean
  is_active?: boolean
  steps?: TAChainStepIn[]
}

export interface TAChainListParams {
  search?: string
  department_id?: number
  department_ids?: number[]
  chain_type?: ChainType
  include_inactive?: boolean
}
