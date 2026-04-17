import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDictionaryNode,
  getDictionaryTree,
  hideDictionaryNode,
  unhideDictionaryNode,
  updateDictionaryNode,
} from '../api/taDictionaryApi'
import type { TADictionaryNodeCreate, TADictionaryNodeUpdate } from '../api/types'

const KEY = ['ta-dictionary'] as const

export function useDictionaryTree(chainId: number | null) {
  return useQuery({
    queryKey: [...KEY, chainId],
    queryFn: () => getDictionaryTree(chainId!),
    enabled: chainId !== null,
  })
}

export function useCreateDictionaryNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ chainId, payload }: { chainId: number; payload: TADictionaryNodeCreate }) =>
      createDictionaryNode(chainId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateDictionaryNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TADictionaryNodeUpdate }) =>
      updateDictionaryNode(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useHideDictionaryNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => hideDictionaryNode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUnhideDictionaryNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unhideDictionaryNode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
