import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveLibraryCall,
  bumpLibraryView,
  createLibraryCall,
  listLibraryCalls,
  listLibraryTags,
  toggleLibraryHelpful,
  updateLibraryCall,
} from '../api/libraryService'
import type {
  LibraryCallCreatePayload,
  LibraryCallListFilters,
  LibraryCallUpdatePayload,
} from '../types/library'

export const libraryKeys = {
  all: ['training', 'library'] as const,
  list: (filters: LibraryCallListFilters) =>
    [...libraryKeys.all, 'list', filters] as const,
  tags: () => [...libraryKeys.all, 'tags'] as const,
  detail: (id: number) => [...libraryKeys.all, 'detail', id] as const,
}

export function useLibraryCalls(
  filters: LibraryCallListFilters = {},
  enabled = true
) {
  return useQuery({
    queryKey: libraryKeys.list(filters),
    queryFn: () => listLibraryCalls(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useLibraryTags(enabled = true) {
  return useQuery({
    queryKey: libraryKeys.tags(),
    queryFn: () => listLibraryTags(),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useCreateLibraryCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: LibraryCallCreatePayload) => createLibraryCall(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })
}

export function useUpdateLibraryCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: LibraryCallUpdatePayload
    }) => updateLibraryCall(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })
}

export function useArchiveLibraryCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => archiveLibraryCall(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })
}

export function useToggleLibraryHelpful() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => toggleLibraryHelpful(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })
}

export function useBumpLibraryView() {
  // Fire-and-forget — no cache invalidation. View counts ride on the next
  // list refresh and a per-click bump shouldn't kick the whole grid.
  return useMutation({
    mutationFn: (id: number) => bumpLibraryView(id),
  })
}
