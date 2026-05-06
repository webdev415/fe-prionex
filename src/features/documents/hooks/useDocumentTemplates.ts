import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import {
  createDocumentTemplate,
  deleteDocumentTemplate,
  getDocumentTemplate,
  listDocumentTemplates,
  updateDocumentTemplate,
} from '../api/documentTemplatesApi'
import type { DocumentTemplateCreatePayload, DocumentTemplateUpdatePayload } from '../api/types'

export const documentTemplateKeys = {
  all: ['document-templates'] as const,
  list: (includeInactive: boolean) =>
    [...documentTemplateKeys.all, 'list', { includeInactive }] as const,
  detail: (id: number) => [...documentTemplateKeys.all, 'detail', id] as const,
}

export function useDocumentTemplates(includeInactive = false) {
  return useQuery({
    queryKey: documentTemplateKeys.list(includeInactive),
    queryFn: () => listDocumentTemplates(includeInactive),
    staleTime: 0,
  })
}

export function useDocumentTemplate(id: number | null) {
  return useQuery({
    queryKey: id ? documentTemplateKeys.detail(id) : ['document-templates', 'detail', null],
    queryFn: () => getDocumentTemplate(id as number),
    enabled: !!id,
  })
}

function extractError(error: AxiosError<{ detail?: string }>, fallback: string): string {
  return error?.response?.data?.detail || fallback
}

export function useCreateDocumentTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: DocumentTemplateCreatePayload) => createDocumentTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentTemplateKeys.all })
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      toast.error(extractError(error, 'Failed to create template'))
    },
  })
}

export function useUpdateDocumentTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DocumentTemplateUpdatePayload }) =>
      updateDocumentTemplate(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentTemplateKeys.all })
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      toast.error(extractError(error, 'Failed to update template'))
    },
  })
}

export function useDeleteDocumentTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteDocumentTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentTemplateKeys.all })
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      toast.error(extractError(error, 'Failed to delete template'))
    },
  })
}
