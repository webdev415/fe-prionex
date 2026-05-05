import api from '@/lib/api'
import type { QuickPick, QuickPickCreate } from './types'

export async function getQuickPicks(departmentId?: number): Promise<QuickPick[]> {
  const params = departmentId != null ? { department_id: departmentId } : undefined
  const r = await api.get<QuickPick[]>('/api/v1/quick-picks', { params })
  return r.data
}

export async function createQuickPick(payload: QuickPickCreate): Promise<QuickPick> {
  const r = await api.post<QuickPick>('/api/v1/quick-picks', payload)
  return r.data
}

export async function deleteQuickPick(id: number): Promise<void> {
  await api.delete(`/api/v1/quick-picks/${id}`)
}

export async function reorderQuickPicks(
  items: Array<{ id: number; sort_order: number }>
): Promise<QuickPick[]> {
  const r = await api.put<QuickPick[]>('/api/v1/quick-picks/reorder', { items })
  return r.data
}
