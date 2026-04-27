/**
 * React Query hooks for TA Chains (KAN-318).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  activateTAChain,
  cloneTAChain,
  createTAChain,
  deactivateTAChain,
  getTAChain,
  getTAChains,
  pinTAChain,
  unpinTAChain,
  updateTAChain,
} from '../api/taChainsApi'
import type { TAChainCreate, TAChainListParams, TAChainUpdate } from '../api/types'

const KEY = ['ta-chains'] as const

export function useTAChains(params?: TAChainListParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => getTAChains(params),
  })
}

export function useTAChain(id: number | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => getTAChain(id!),
    enabled: id !== null,
  })
}

export function useCreateTAChain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TAChainCreate) => createTAChain(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['target-actions'] })
    },
  })
}

export function useUpdateTAChain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TAChainUpdate }) =>
      updateTAChain(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['target-actions'] })
    },
  })
}

export function useCloneTAChain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cloneTAChain(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['target-actions'] })
    },
  })
}

export function useDeactivateTAChain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deactivateTAChain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useActivateTAChain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => activateTAChain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function usePinTAChain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => pinTAChain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUnpinTAChain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unpinTAChain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
