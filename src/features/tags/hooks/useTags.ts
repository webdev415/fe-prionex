/**
 * useTags Hooks
 *
 * React Query hooks for tags CRUD operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tagsApi } from '../api/tagsApi'
import type { TagCreate, TagUpdate } from '../types'

/**
 * Query key factory for tags queries
 */
export const tagsKeys = {
  all: ['tags'] as const,
  lists: () => [...tagsKeys.all, 'list'] as const,
  list: (projectId?: number) => [...tagsKeys.lists(), { projectId }] as const,
  details: () => [...tagsKeys.all, 'detail'] as const,
  detail: (id: number) => [...tagsKeys.details(), id] as const,
}

/**
 * Fetch tags list
 *
 * @param projectId - Optional project ID filter
 * @returns React Query result with tags data
 */
export function useTags(projectId?: number) {
  return useQuery({
    queryKey: tagsKeys.list(projectId),
    queryFn: () => tagsApi.getTags(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Create new tag mutation
 */
export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TagCreate) => tagsApi.createTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() })
      toast.success('Tag created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create tag')
    },
  })
}

/**
 * Update tag mutation
 */
export function useUpdateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TagUpdate }) => tagsApi.updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() })
      toast.success('Tag updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tag')
    },
  })
}

/**
 * Delete tag mutation
 */
export function useDeleteTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => tagsApi.deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() })
      toast.success('Tag deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tag')
    },
  })
}

/**
 * Fetch client tags
 *
 * @param clientId - Client ID
 * @returns React Query result with client tags data
 */
export function useClientTags(clientId: number) {
  return useQuery({
    queryKey: ['clients', clientId, 'tags'] as const,
    queryFn: () => tagsApi.getClientTags(clientId),
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Assign tag to client mutation
 */
export function useAssignClientTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, tagId }: { clientId: number; tagId: number }) =>
      tagsApi.assignClientTag(clientId, tagId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['clients', clientId, 'tags'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign tag')
    },
  })
}

/**
 * Remove tag from client mutation
 */
export function useRemoveClientTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, tagId }: { clientId: number; tagId: number }) =>
      tagsApi.removeClientTag(clientId, tagId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['clients', clientId, 'tags'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove tag')
    },
  })
}

/**
 * Bulk tag clients mutation (add or remove tags from multiple clients)
 */
export function useBulkTagClients() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { client_ids: number[]; tag_ids: number[]; action: 'add' | 'remove' }) =>
      tagsApi.bulkTagClients(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() })
      toast.success(
        `Successfully ${variables.action === 'add' ? 'added tags to' : 'removed tags from'} ${variables.client_ids.length} client(s)`
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tags')
    },
  })
}
