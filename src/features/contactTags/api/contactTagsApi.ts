import api from '@/lib/api'
import type {
  ContactTagAssignmentCategory,
  ContactTagCategory,
  ContactTagHistoryEntry,
  ContactTagValue,
} from '../types'

export async function listContactTagCategories(
  status: 'all' | 'active' | 'hidden' = 'all'
): Promise<ContactTagCategory[]> {
  const r = await api.get<ContactTagCategory[]>('/api/v1/clients/contact-tag-categories', {
    params: { status },
  })
  return r.data
}

export async function createContactTagCategory(payload: {
  name: string
  selection_type: 'single' | 'multi'
  is_protected: boolean
  protected_role_ids: number[]
  sort_order: number
}): Promise<ContactTagCategory> {
  const r = await api.post<ContactTagCategory>('/api/v1/clients/contact-tag-categories', payload)
  return r.data
}

export async function patchContactTagCategory(
  categoryId: number,
  payload: Partial<{
    name: string
    selection_type: 'single' | 'multi'
    is_protected: boolean
    protected_role_ids: number[]
    is_hidden: boolean
    sort_order: number
  }>
): Promise<ContactTagCategory> {
  const r = await api.patch<ContactTagCategory>(
    `/api/v1/clients/contact-tag-categories/${categoryId}`,
    payload
  )
  return r.data
}

export async function createContactTagValue(
  categoryId: number,
  payload: {
    name: string
    color?: string | null
    blocks_calls: boolean
    blocks_sms: boolean
    blocks_spam: boolean
    sort_order: number
  }
): Promise<ContactTagValue> {
  const r = await api.post<ContactTagValue>(
    `/api/v1/clients/contact-tag-categories/${categoryId}/values`,
    payload
  )
  return r.data
}

export async function patchContactTagValue(
  valueId: number,
  payload: Partial<{
    name: string
    color: string | null
    blocks_calls: boolean
    blocks_sms: boolean
    blocks_spam: boolean
    is_hidden: boolean
    sort_order: number
  }>
): Promise<ContactTagValue> {
  const r = await api.patch<ContactTagValue>(
    `/api/v1/clients/contact-tag-values/${valueId}`,
    payload
  )
  return r.data
}

export async function getContactTags(
  clientId: number,
  contactId: number
): Promise<ContactTagAssignmentCategory[]> {
  const r = await api.get<ContactTagAssignmentCategory[]>(
    `/api/v1/clients/${clientId}/contacts/${contactId}/tags`
  )
  return r.data
}

export async function setContactTags(
  clientId: number,
  contactId: number,
  payload: { category_id: number; value_ids: number[] }
): Promise<ContactTagAssignmentCategory[]> {
  const r = await api.put<ContactTagAssignmentCategory[]>(
    `/api/v1/clients/${clientId}/contacts/${contactId}/tags`,
    payload
  )
  return r.data
}

export async function getContactTagHistory(
  clientId: number,
  contactId: number,
  limit = 100
): Promise<ContactTagHistoryEntry[]> {
  const r = await api.get<ContactTagHistoryEntry[]>(
    `/api/v1/clients/${clientId}/contacts/${contactId}/tags/history`,
    { params: { limit } }
  )
  return r.data
}

export async function bulkContactTagUpdate(payload: {
  assignments: Array<{ contact_id: number; category_id: number; value_ids: number[] }>
  removals: Array<{ contact_id: number; category_id: number; value_ids: number[] }>
}): Promise<{ assigned: number; removed: number }> {
  const r = await api.post<{ assigned: number; removed: number }>(
    '/api/v1/clients/contacts/tags/bulk',
    payload
  )
  return r.data
}
