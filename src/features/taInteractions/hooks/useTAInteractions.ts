import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  advanceChainInstance,
  cancelChainInstance,
  completeChainInstance,
  createTAInteraction,
  getChainInstances,
  getClientPinnedChainIds,
  getTAInteraction,
  getTAInteractions,
  startChainInstance,
  togglePinTAInteraction,
  updateTAInteraction,
} from '../api/taInteractionsApi'
import type {
  ChainInstanceCreate,
  TAInteractionCreate,
  TAInteractionListParams,
  TAInteractionUpdate,
} from '../api/types'

const INT_KEY = ['ta-interactions'] as const
const INST_KEY = ['chain-instances'] as const

export function useClientTAInteractions(
  clientId: number | null,
  params?: Omit<TAInteractionListParams, 'client_id'>
) {
  return useQuery({
    queryKey: [...INT_KEY, 'client', clientId, params],
    queryFn: () => getTAInteractions({ client_id: clientId!, ...params }),
    enabled: clientId !== null && clientId > 0,
  })
}

export function useTAInteractions(params: TAInteractionListParams) {
  return useQuery({
    queryKey: [...INT_KEY, params],
    queryFn: () => getTAInteractions(params),
  })
}

export function useCreateTAInteraction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TAInteractionCreate) => createTAInteraction(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INT_KEY })
      qc.invalidateQueries({ queryKey: INST_KEY })
    },
  })
}

export function useTAInteraction(id: number | null) {
  return useQuery({
    queryKey: [...INT_KEY, 'one', id],
    queryFn: () => getTAInteraction(id!),
    enabled: id !== null,
  })
}

export function useUpdateTAInteraction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TAInteractionUpdate }) =>
      updateTAInteraction(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INT_KEY })
    },
  })
}

export function useTogglePinTAInteraction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => togglePinTAInteraction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INT_KEY })
      // Pinned-chain-ids list depends on pin state — refetch so the chain
      // selector re-orders without a manual refresh.
      qc.invalidateQueries({ queryKey: ['ta-pinned-chains'] })
    },
  })
}

export function useClientPinnedChainIds(clientId: number | null) {
  return useQuery({
    queryKey: ['ta-pinned-chains', clientId],
    queryFn: () => getClientPinnedChainIds(clientId!),
    enabled: clientId !== null && clientId > 0,
  })
}

export function useClientChainInstances(clientId: number | null) {
  return useQuery({
    queryKey: [...INST_KEY, 'client', clientId],
    queryFn: () => getChainInstances({ client_id: clientId! }),
    enabled: clientId !== null && clientId > 0,
  })
}

export function useStartChainInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ChainInstanceCreate) => startChainInstance(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: INST_KEY }),
  })
}

export function useCompleteChainInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => completeChainInstance(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INST_KEY }),
  })
}

export function useAdvanceChainInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      leafNodeId,
      dropdownValueId,
    }: {
      id: number
      leafNodeId?: number | null
      dropdownValueId?: number | null
    }) => advanceChainInstance(id, { leafNodeId, dropdownValueId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INST_KEY })
      // Refresh data that effects may have changed
      qc.invalidateQueries({ queryKey: ['clients'] }) // spam call history, tags, etc.
      qc.invalidateQueries({ queryKey: ['tasks'] }) // task bell + task tab
    },
  })
}

export function useCancelChainInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cancelChainInstance(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INST_KEY }),
  })
}
