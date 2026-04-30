import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/chainBuilderApi'

const KEY = ['chain-builder'] as const

export function useBuilderData(chainId: number | null) {
  return useQuery({
    queryKey: [...KEY, chainId],
    queryFn: () => api.getBuilderData(chainId!),
    enabled: chainId !== null,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: KEY })
}

export function useCreateBranch(chainId: number) {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (p: Parameters<typeof api.createBranch>[1]) => api.createBranch(chainId, p),
    onSuccess: inv,
  })
}
export function useDeleteBranch(chainId: number) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (id: number) => api.deleteBranch(chainId, id), onSuccess: inv })
}
export function useCreateTrigger(chainId: number) {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (p: Parameters<typeof api.createTrigger>[1]) => api.createTrigger(chainId, p),
    onSuccess: inv,
  })
}
export function useDeleteTrigger(chainId: number) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (id: number) => api.deleteTrigger(chainId, id), onSuccess: inv })
}
export function useCreateBlocker(chainId: number) {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (p: Parameters<typeof api.createBlocker>[1]) => api.createBlocker(chainId, p),
    onSuccess: inv,
  })
}
export function useDeleteBlocker(chainId: number) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (id: number) => api.deleteBlocker(chainId, id), onSuccess: inv })
}
export function useCreateEffect(chainId: number) {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (p: Parameters<typeof api.createEffect>[1]) => api.createEffect(chainId, p),
    onSuccess: inv,
  })
}
export function useDeleteEffect(chainId: number) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (id: number) => api.deleteEffect(chainId, id), onSuccess: inv })
}
