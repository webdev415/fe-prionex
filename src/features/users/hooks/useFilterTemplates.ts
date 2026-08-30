import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as filterTemplatesApi from '../api/filterTemplatesApi'
import type { SaveFilterTemplateInput, UpdateFilterTemplateInput } from '../types'

export const filterTemplateKeys = {
  all: ['filter-templates'] as const,
}

export function useFilterTemplates(enabled = true) {
  return useQuery({
    queryKey: filterTemplateKeys.all,
    queryFn: filterTemplatesApi.getFilterTemplates,
    enabled,
  })
}

export function useSaveFilterTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveFilterTemplateInput) => filterTemplatesApi.saveFilterTemplate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: filterTemplateKeys.all })
    },
  })
}

export function useUpdateFilterTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateFilterTemplateInput }) =>
      filterTemplatesApi.updateFilterTemplate(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: filterTemplateKeys.all })
    },
  })
}

export function useDeleteFilterTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => filterTemplatesApi.deleteFilterTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: filterTemplateKeys.all })
    },
  })
}
