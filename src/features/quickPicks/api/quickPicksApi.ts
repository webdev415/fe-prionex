import api from '@/lib/api'
import type { QuickPick, QuickPickCreate, QuickPickUpdate } from './types'

export async function getQuickPicks(departmentId?: number): Promise<QuickPick[]> {
  const params = departmentId != null ? { department_id: departmentId } : undefined
  const r = await api.get<QuickPick[]>('/api/v1/quick-picks', { params })
  return r.data
}

export async function createQuickPick(payload: QuickPickCreate): Promise<QuickPick> {
  const r = await api.post<QuickPick>('/api/v1/quick-picks', payload)
  return r.data
}

export async function updateQuickPick(id: number, payload: QuickPickUpdate): Promise<QuickPick> {
  const r = await api.put<QuickPick>(`/api/v1/quick-picks/${id}`, payload)
  return r.data
}

export async function deleteQuickPick(id: number): Promise<void> {
  await api.delete(`/api/v1/quick-picks/${id}`)
}

// Sort order is per-department; the caller must say which one.
export async function reorderQuickPicks(
  departmentId: number,
  items: Array<{ id: number; sort_order: number }>
): Promise<QuickPick[]> {
  const r = await api.put<QuickPick[]>('/api/v1/quick-picks/reorder', {
    department_id: departmentId,
    items,
  })
  return r.data
}
