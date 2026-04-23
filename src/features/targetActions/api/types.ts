/**
 * Target Actions (KAN-317) — API types
 */

export type TAFieldType = 'text' | 'dropdown' | 'date' | 'amount' | 'credit'

export interface TADropdownValueIn {
  value: string
  sort_order?: number
  require_promise_date?: boolean
  require_promise_amount?: boolean
  require_credit?: boolean
  is_positive?: boolean
}

export interface TADropdownValueOut {
  id: number
  value: string
  sort_order: number
  is_hidden: boolean
  require_promise_date: boolean
  require_promise_amount: boolean
  require_credit: boolean
  is_positive: boolean
}

export interface TargetAction {
  id: number
  name: string
  field_type: TAFieldType
  is_hidden: boolean
  usage_count: number
  dropdown_values: TADropdownValueOut[]
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface TargetActionListResponse {
  total: number
  items: TargetAction[]
}

export interface TargetActionCreate {
  name: string
  field_type: TAFieldType
  dropdown_values?: TADropdownValueIn[]
}

export interface TargetActionUpdate {
  name?: string
  dropdown_values?: TADropdownValueIn[]
}

export interface TargetActionListParams {
  search?: string
  field_type?: TAFieldType
  include_hidden?: boolean
}
