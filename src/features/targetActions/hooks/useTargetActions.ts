/**
 * React Query hooks for Target Actions (KAN-317).
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cloneTargetAction,
  createTargetAction,
  getTargetAction,
  getTargetActions,
  hideTargetAction,
  unhideTargetAction,
  updateTargetAction,
} from '../api/targetActionsApi'
import type { TargetActionCreate, TargetActionListParams, TargetActionUpdate } from '../api/types'

const KEY = ['target-actions'] as const

export function useTargetActions(params?: TargetActionListParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => getTargetActions(params),
    placeholderData: keepPreviousData,
  })
}

export function useTargetAction(id: number | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => getTargetAction(id!),
    enabled: id !== null,
  })
}

export function useCreateTargetAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TargetActionCreate) => createTargetAction(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateTargetAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TargetActionUpdate }) =>
      updateTargetAction(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCloneTargetAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cloneTargetAction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useHideTargetAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => hideTargetAction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUnhideTargetAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unhideTargetAction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
