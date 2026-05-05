import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createQuickPick,
  deleteQuickPick,
  getQuickPicks,
  reorderQuickPicks,
} from '../api/quickPicksApi'
import type { QuickPickCreate } from '../api/types'

const KEY = ['quick-picks'] as const

export function useQuickPicks(departmentId?: number) {
  return useQuery({
    queryKey: [...KEY, departmentId],
    queryFn: () => getQuickPicks(departmentId),
    enabled: departmentId !== undefined,
  })
}

export function useCreateQuickPick() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: QuickPickCreate) => createQuickPick(payload),
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

export function useReorderQuickPicks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: Array<{ id: number; sort_order: number }>) => reorderQuickPicks(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
