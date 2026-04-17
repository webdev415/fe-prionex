export interface TADictionaryNode {
  id: number
  chain_id: number
  parent_id: number | null
  name: string
  sort_order: number
  is_leaf: boolean
  require_promise_date: boolean
  require_promise_amount: boolean
  require_credit: boolean
  is_positive: boolean
  is_hidden: boolean
  children: TADictionaryNode[]
  created_at: string
  updated_at: string
}

export interface TADictionaryTreeResponse {
  chain_id: number
  nodes: TADictionaryNode[]
}

export interface TADictionaryNodeCreate {
  chain_id: number
  parent_id?: number | null
  name: string
  sort_order?: number
  is_leaf?: boolean
  require_promise_date?: boolean
  require_promise_amount?: boolean
  require_credit?: boolean
  is_positive?: boolean
}

export interface TADictionaryNodeUpdate {
  name?: string
  sort_order?: number
  is_leaf?: boolean
  require_promise_date?: boolean
  require_promise_amount?: boolean
  require_credit?: boolean
  is_positive?: boolean
  parent_id?: number
}
