import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createQuickPick,
  deleteQuickPick,
  getQuickPicks,
  reorderQuickPicks,
  updateQuickPick,
} from '../api/quickPicksApi'
import type { QuickPickCreate, QuickPickUpdate } from '../api/types'

const KEY = ['quick-picks'] as const

export function useQuickPicks(departmentId?: number, opts?: { fetchAll?: boolean }) {
  const fetchAll = opts?.fetchAll ?? false
  return useQuery({
    queryKey: [...KEY, fetchAll ? 'all' : (departmentId ?? null)],
    queryFn: () => getQuickPicks(fetchAll ? undefined : departmentId),
    enabled: fetchAll || departmentId !== undefined,
  })
}

export function useCreateQuickPick() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: QuickPickCreate) => createQuickPick(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateQuickPick() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: QuickPickUpdate }) =>
      updateQuickPick(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteQuickPick() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteQuickPick(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

// Reorder is per-department; sort_order lives on the (pick, department)
// junction row, so the caller must say which department's list is being
// reordered.
export function useReorderQuickPicks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      departmentId,
      items,
    }: {
      departmentId: number
      items: Array<{ id: number; sort_order: number }>
    }) => reorderQuickPicks(departmentId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
