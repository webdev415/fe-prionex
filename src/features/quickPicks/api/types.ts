export interface QuickPick {
  id: number
  chain_id: number
  chain_name: string | null
  department_id: number
  sort_order: number
}

export interface QuickPickCreate {
  chain_id: number
  department_id: number
}
