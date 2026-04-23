export interface QuickPick {
  id: number
  chain_id: number
  chain_name: string | null
  name: string | null
  department_id: number
  sort_order: number
  preset_values: Record<string, string> | null
}

export interface QuickPickCreate {
  chain_id: number
  department_id: number
  name?: string
  preset_values?: Record<string, string>
}
