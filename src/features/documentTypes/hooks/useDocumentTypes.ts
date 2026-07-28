/**
 * React Query hooks for the document-types CRUD.
 *
 * The list query is scoped by the active project (via the JWT on the
 * BE), so ``queryKey`` includes ``includeHidden`` only — a separate
 * query is cached per include-hidden flavour. Mutations invalidate the
 * lists() family so both flavours refetch after any change.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { documentTypesApi } from '../api/documentTypesApi'
import type {
  DocumentType,
  DocumentTypeCreate,
  DocumentTypeUpdate,
  DocumentTypeVisibilityUpdate,
} from '../types'

export const documentTypesKeys = {
  all: ['documentTypes'] as const,
  lists: () => [...documentTypesKeys.all, 'list'] as const,
  list: (includeHidden: boolean, withCounts: boolean) =>
    [...documentTypesKeys.lists(), { includeHidden, withCounts }] as const,
}

interface UseDocumentTypesOptions {
  includeHidden?: boolean
  /**
   * Request per-type ``doc_count`` from the BE. OFF by default — turning
   * it on makes the BE scan the whole client_documents table, so only the
   * admin management tab should set it. ``withCounts`` is part of the
   * query key, so count and no-count variants are cached separately (the
   * journal filter never triggers the expensive count fetch).
   */
  withCounts?: boolean
}

export function useDocumentTypes(options: UseDocumentTypesOptions = {}) {
  const includeHidden = options.includeHidden ?? false
  const withCounts = options.withCounts ?? false
  return useQuery<DocumentType[]>({
    queryKey: documentTypesKeys.list(includeHidden, withCounts),
    queryFn: () => documentTypesApi.list(includeHidden, withCounts),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateDocumentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DocumentTypeCreate) => documentTypesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentTypesKeys.lists() })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create document type')
    },
  })
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: DocumentTypeUpdate }) =>
      documentTypesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentTypesKeys.lists() })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update document type')
    },
  })
}

export function useUpdateDocumentTypeVisibility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: DocumentTypeVisibilityUpdate }) =>
      documentTypesApi.updateVisibility(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentTypesKeys.lists() })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update visibility')
    },
  })
}

export function useDeleteDocumentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => documentTypesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentTypesKeys.lists() })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document type')
    },
  })
}
