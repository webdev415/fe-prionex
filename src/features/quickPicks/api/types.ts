export interface QuickPick {
  id: number
  chain_id: number
  chain_name: string | null
  name: string | null
  // A pick can belong to multiple departments. When the list endpoint
  // is filtered by ``?department_id=X``, ``sort_order`` reflects this
  // pick's order within X; otherwise it is 0.
  department_ids: number[]
  sort_order: number
  preset_values: Record<string, string> | null
}

export interface QuickPickCreate {
  chain_id: number
  department_ids: number[]
  name?: string
  preset_values?: Record<string, string>
}

export interface QuickPickUpdate {
  name?: string
  department_ids?: number[]
  preset_values?: Record<string, string>
}
