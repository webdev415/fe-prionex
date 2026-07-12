import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientKeys } from '@/features/clients/hooks/useClients'
import * as contactTagsApi from '../api/contactTagsApi'

export function useContactTagCategories(status: 'all' | 'active' | 'hidden' = 'all') {
  return useQuery({
    queryKey: ['contact-tag-categories', status],
    queryFn: () => contactTagsApi.listContactTagCategories(status),
  })
}

export function useCreateContactTagCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contactTagsApi.createContactTagCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-tag-categories'] }),
  })
}

export function usePatchContactTagCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      categoryId,
      payload,
    }: {
      categoryId: number
      payload: Parameters<typeof contactTagsApi.patchContactTagCategory>[1]
    }) => contactTagsApi.patchContactTagCategory(categoryId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-tag-categories'] }),
  })
}

export function useCreateContactTagValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      categoryId,
      payload,
    }: {
      categoryId: number
      payload: Parameters<typeof contactTagsApi.createContactTagValue>[1]
    }) => contactTagsApi.createContactTagValue(categoryId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-tag-categories'] }),
  })
}

export function usePatchContactTagValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      valueId,
      payload,
    }: {
      valueId: number
      payload: Parameters<typeof contactTagsApi.patchContactTagValue>[1]
    }) => contactTagsApi.patchContactTagValue(valueId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-tag-categories'] }),
  })
}

export function useContactTags(clientId: number, contactId: number, enabled = true) {
  return useQuery({
    queryKey: ['contact-tags', clientId, contactId],
    queryFn: () => contactTagsApi.getContactTags(clientId, contactId),
    enabled: enabled && clientId > 0 && contactId > 0,
  })
}

export function useSetContactTags(clientId: number, contactId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { category_id: number; value_ids: number[] }) =>
      contactTagsApi.setContactTags(clientId, contactId, payload),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['contact-tags', clientId, contactId] }),
        qc.invalidateQueries({ queryKey: ['contact-tag-history', clientId, contactId] }),
        qc.refetchQueries({ queryKey: clientKeys.profile(clientId) }),
      ])
    },
  })
}

export function useSetLastCallResultFromCall(clientId: number | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { phone: string; outcome: string }) => {
      if (!clientId) {
        return Promise.resolve()
      }
      return contactTagsApi.setLastCallResultFromCall(clientId, payload)
    },
    onSuccess: async () => {
      if (!clientId) return
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['contact-tags', clientId] }),
        qc.invalidateQueries({ queryKey: ['contact-tag-history', clientId] }),
        qc.refetchQueries({ queryKey: clientKeys.profile(clientId) }),
      ])
    },
  })
}

export function useContactTagHistory(clientId: number, contactId: number, enabled = false) {
  return useQuery({
    queryKey: ['contact-tag-history', clientId, contactId],
    queryFn: () => contactTagsApi.getContactTagHistory(clientId, contactId),
    enabled: enabled && clientId > 0 && contactId > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
