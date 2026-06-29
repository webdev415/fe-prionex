/**
 * useTags Hooks
 *
 * React Query hooks for tags CRUD operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tagsApi } from '../api/tagsApi'
import { useAuthStore } from '@/stores/authStore'
import { filterTagsForRole } from '../utils/visibility'
import { clientKeys } from '@/features/clients/hooks/useClients'
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
  removalRequests: () => ['removalRequests'] as const,
  segmentClients: (id: number, skip: number, limit: number) =>
    ['segmentClients', id, skip, limit] as const,
}

/**
 * Fetch tags list
 *
 * @param projectId - Optional project ID filter
 * @returns React Query result with tags data
 */
export function useTags(projectId?: number, options?: { includeHidden?: boolean }) {
  const roleName = useAuthStore((state) => state.user?.active_role_name)
  const activeDepartmentId = useAuthStore((state) => state.user?.active_department_id)
  const includeHidden = options?.includeHidden ?? false
  return useQuery({
    queryKey: [...tagsKeys.list(projectId), { includeHidden, roleName, activeDepartmentId }],
    queryFn: () => tagsApi.getTags(projectId),
    select: (tags) => filterTagsForRole(tags, roleName, includeHidden),
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
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
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
export function useClientTags(clientId: number, options?: { includeHidden?: boolean }) {
  const roleName = useAuthStore((state) => state.user?.active_role_name)
  const includeHidden = options?.includeHidden ?? false
  return useQuery({
    queryKey: ['clients', clientId, 'tags', { includeHidden, roleName }] as const,
    queryFn: () => tagsApi.getClientTags(clientId),
    select: (tags) => filterTagsForRole(tags, roleName, includeHidden),
    enabled: !!clientId,
    staleTime: 0, // Always refetch on invalidation (auto-tagging is async)
    // Cron-driven and cross-session tag changes (другой оператор / scheduled
    // правило) не триггерят локальный invalidate — без polling они не появятся
    // до F5. KAN-610: 60s — компромисс между свежестью тегов и нагрузкой на
    // client-service (на 100 операторов 30s давал ~200 фоновых запросов/мин
    // только по тегам). Мгновенные обновления после мутаций покрывает invalidate.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
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
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
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
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
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
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
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

export function useSegmentClients(segmentId: number | null, skip: number, limit: number) {
  return useQuery({
    queryKey: tagsKeys.segmentClients(segmentId ?? 0, skip, limit),
    queryFn: () => tagsApi.getSegmentClients(segmentId!, skip, limit),
    enabled: segmentId !== null,
    staleTime: 30_000,
  })
}

// ============================================================================
// Removal Requests
// ============================================================================

export function useRemovalRequests() {
  return useQuery({
    queryKey: tagsKeys.removalRequests(),
    queryFn: () => tagsApi.getRemovalRequests(),
    staleTime: 60_000,
  })
}

export function useRequestTagRemoval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      clientId,
      tagId,
      reason,
    }: {
      clientId: number
      tagId: number
      reason?: string
    }) => tagsApi.requestTagRemoval(clientId, tagId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.removalRequests() })
      toast.success('Removal request submitted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit removal request')
    },
  })
}

export function useApproveRemoval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: number; reason?: string }) =>
      tagsApi.approveRemovalRequest(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.removalRequests() })
      queryClient.invalidateQueries({ queryKey: tagsKeys.all })
      toast.success('Tag removal approved')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve removal')
    },
  })
}

export function useRejectRemoval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: number; reason?: string }) =>
      tagsApi.rejectRemovalRequest(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.removalRequests() })
      toast.success('Tag removal rejected')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject removal')
    },
  })
}
