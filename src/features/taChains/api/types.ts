/**
 * TA Chains (KAN-318) — API types
 */

export type ChainType = 'manual' | 'automatic'

export interface TAChainStepIn {
  target_action_id: number
  is_required?: boolean
  delay_minutes?: number
  not_in_the_past?: boolean
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
