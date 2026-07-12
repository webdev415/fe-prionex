export type ContactTagSelectionType = 'single' | 'multi'

export interface ContactTagValue {
  id: number
  category_id: number
  code?: string | null
  name: string
  color?: string | null
  blocks_calls: boolean
  blocks_sms: boolean
  blocks_spam: boolean
  is_hidden: boolean
  sort_order: number
}

export interface ContactTagCategory {
  id: number
  code: string
  name: string
  selection_type: ContactTagSelectionType
  is_protected: boolean
  protected_role_ids: number[]
  is_system: boolean
  is_hidden: boolean
  sort_order: number
  values: ContactTagValue[]
}

export interface ContactTagChip {
  value_id: number
  category_id: number
  category_name: string
  category_code: string
  selection_type: ContactTagSelectionType
  is_protected: boolean
  is_system: boolean
  name: string
  color?: string | null
  blocks_calls: boolean
  blocks_sms: boolean
  blocks_spam: boolean
  can_edit: boolean
}

export interface ContactBlockingFlags {
  blocks_calls: boolean
  blocks_sms: boolean
  blocks_spam: boolean
  reasons: string[]
}

export interface ContactTagAssignmentCategory {
  category_id: number
  category_name: string
  category_code: string
  selection_type: ContactTagSelectionType
  is_protected: boolean
  is_system: boolean
  can_edit: boolean
  assigned_value_ids: number[]
  values: ContactTagValue[]
}

export interface ContactTagHistoryEntry {
  id: number
  contact_id: number
  category_id: number
  category_name: string
  old_value_names: string[]
  new_value_names: string[]
  actor_name: string
  actor_type: string
  created_at: string
}
