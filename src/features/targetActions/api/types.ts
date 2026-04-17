/**
 * Target Actions (KAN-317) — API types
 */

export type TAFieldType = 'text' | 'dropdown' | 'date' | 'amount'

export interface TADropdownValueIn {
  value: string
  sort_order?: number
}

export interface TADropdownValueOut {
  id: number
  value: string
  sort_order: number
  is_hidden: boolean
}

export interface TargetAction {
  id: number
  name: string
  field_type: TAFieldType
  department_id: number
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
  department_id: number
  dropdown_values?: TADropdownValueIn[]
}

export interface TargetActionUpdate {
  name?: string
  department_id?: number
  dropdown_values?: TADropdownValueIn[]
}

export interface TargetActionListParams {
  search?: string
  department_id?: number
  field_type?: TAFieldType
  include_hidden?: boolean
}
