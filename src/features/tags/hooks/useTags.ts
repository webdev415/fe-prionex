/**
 * useTags Hooks
 *
 * React Query hooks for tags CRUD operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tagsApi } from '../api/tagsApi'
import type {
  TagCreate,
  TagDefinitionCreate,
  TagDefinitionUpdate,
  TagRuleCreate,
  TagRuleUpdate,
  SegmentCreate,
  SegmentUpdate,
  SegmentCondition,
} from '../types'

/**
 * Query key factory for tags queries
 */
export const tagsKeys = {
  all: ['tags'] as const,
  lists: () => [...tagsKeys.all, 'list'] as const,
  list: (projectId?: number) => [...tagsKeys.lists(), { projectId }] as const,
  details: () => [...tagsKeys.all, 'detail'] as const,
  detail: (id: number) => [...tagsKeys.details(), id] as const,
  rules: () => ['rules'] as const,
  segments: () => ['segments'] as const,
  clientState: (clientId: number) => ['clientState', clientId] as const,
  clientHistory: (clientId: number) => ['clientTagHistory', clientId] as const,
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
    mutationFn: ({ id, data }: { id: number; data: TagDefinitionUpdate }) =>
      tagsApi.updateTag(id, data),
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

// ============================================================================
// Extended Hooks (Rules, Segments, State)
// ============================================================================

/**
 * Create tag with extended fields
 */
export function useCreateTagExtended() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TagDefinitionCreate) => tagsApi.createTagExtended(data),
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
 * Get client tag history
 */
export function useClientTagHistory(clientId: number) {
  return useQuery({
    queryKey: tagsKeys.clientHistory(clientId),
    queryFn: () => tagsApi.getClientTagHistory(clientId),
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Get client state (aggregated from active tags)
 */
export function useClientState(clientId: number) {
  return useQuery({
    queryKey: tagsKeys.clientState(clientId),
    queryFn: () => tagsApi.getClientState(clientId),
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  })
}

// --- Rules ---

export function useTagRules(params?: {
  trigger_type?: string
  is_active?: boolean
  enabled?: boolean
}) {
  const { enabled = true, ...queryParams } = params ?? {}
  return useQuery({
    queryKey: [...tagsKeys.rules(), queryParams],
    queryFn: () => tagsApi.getRules(queryParams),
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}

export function useCreateRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TagRuleCreate) => tagsApi.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.rules() })
      toast.success('Rule created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create rule')
    },
  })
}

export function useUpdateRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TagRuleUpdate }) => tagsApi.updateRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.rules() })
      toast.success('Rule updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update rule')
    },
  })
}

export function useDeleteRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => tagsApi.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.rules() })
      toast.success('Rule deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete rule')
    },
  })
}

// --- Segments ---

export function useSegments(params?: { is_active?: boolean; enabled?: boolean }) {
  const { enabled = true, ...queryParams } = params ?? {}
  return useQuery({
    queryKey: [...tagsKeys.segments(), queryParams],
    queryFn: () => tagsApi.getSegments(queryParams),
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}

export function useCreateSegment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SegmentCreate) => tagsApi.createSegment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.segments() })
      toast.success('Segment created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create segment')
    },
  })
}

export function useUpdateSegment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SegmentUpdate }) =>
      tagsApi.updateSegment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.segments() })
      toast.success('Segment updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update segment')
    },
  })
}

export function useDeleteSegment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => tagsApi.deleteSegment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.segments() })
      toast.success('Segment deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete segment')
    },
  })
}

export function usePreviewSegment() {
  return useMutation({
    mutationFn: (conditions: Omit<SegmentCondition, 'id' | 'segment_id'>[]) =>
      tagsApi.previewSegment(conditions),
  })
}

export function useRefreshSegment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => tagsApi.refreshSegment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.segments() })
      toast.success('Segment refreshed')
    },
  })
}
