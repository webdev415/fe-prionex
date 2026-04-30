/**
 * Tags API Client
 *
 * API functions for tag CRUD operations.
 * Implements endpoints from tags-service /api/v1/tags.
 */

import api from '@/lib/api'
import type { Tag, TagDefinition, TagCreate, TagDefinitionUpdate } from '../types'
import { isOperatorVisibleTag } from '../utils/visibility'

/**
 * Fetch tags list for a project
 *
 * @param projectId - Project ID to filter tags
 * @returns List of tags
 */
export async function getTags(
  projectId?: number,
  options?: { includeHidden?: boolean }
): Promise<TagDefinition[]> {
  const params = projectId ? { project_id: projectId } : {}
  const response = await api.get<TagDefinition[]>('/api/v1/tags', { params })
  if (options?.includeHidden) {
    return response.data
  }
  return response.data.filter(isOperatorVisibleTag)
}

/**
 * Create a new tag
 *
 * @param input - Tag creation data
 * @returns Created tag
 */
export async function createTag(input: TagCreate): Promise<Tag> {
  const response = await api.post<Tag>('/api/v1/tags', input)
  return response.data
}

/**
 * Update existing tag
 *
 * @param id - Tag ID
 * @param input - Fields to update
 * @returns Updated tag
 */
export async function updateTag(id: number, input: TagDefinitionUpdate): Promise<Tag> {
  const response = await api.put<Tag>(`/api/v1/tags/${id}`, input)
  return response.data
}

/**
 * Delete tag
 *
 * @param id - Tag ID
 * @returns Success response
 */
export async function deleteTag(id: number): Promise<{ success: boolean; message?: string }> {
  const response = await api.delete<{ success: boolean; message?: string }>(`/api/v1/tags/${id}`)
  return response.data
}

/**
 * Get tags assigned to a client
 *
 * @param clientId - Client ID
 * @returns List of tags assigned to the client
 */
export async function getClientTags(clientId: number): Promise<TagDefinition[]> {
  const response = await api.get<TagDefinition[]>(`/api/v1/clients/${clientId}/tags`)
  return response.data.filter(isOperatorVisibleTag)
}

/**
 * Assign tag to a client
 *
 * @param clientId - Client ID
 * @param tagId - Tag ID to assign
 * @returns Success response
 */
export async function assignClientTag(
  clientId: number,
  tagId: number
): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>(`/api/v1/clients/${clientId}/tags`, {
    tag_id: tagId,
  })
  return response.data
}

/**
 * Remove tag from a client
 *
 * @param clientId - Client ID
 * @param tagId - Tag ID to remove
 * @returns Success response
 */
export async function removeClientTag(
  clientId: number,
  tagId: number
): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(
    `/api/v1/clients/${clientId}/tags/${tagId}`
  )
  return response.data
}

/**
 * Bulk assign or remove tags from multiple clients
 *
 * @param data - Bulk tag operation data
 * @returns Success response
 */
export async function bulkTagClients(data: {
  client_ids: number[]
  tag_ids: number[]
  action: 'add' | 'remove'
}): Promise<{ success: boolean; message?: string }> {
  const response = await api.post<{ success: boolean; message?: string }>(
    '/api/v1/clients/bulk/tags',
    data
  )
  return response.data
}

// ============================================================================
// Extended API (Segments, Rules, State, History)
// ============================================================================

import type {
  TagRule,
  TagRuleCreate,
  TagRuleUpdate,
  Segment,
  SegmentCreate,
  SegmentUpdate,
  SegmentPreview,
  SegmentClientsPage,
  ClientState,
  TagAssignmentLog,
  TagDefinitionCreate,
  RemovalRequest,
} from '../types'

/**
 * Assign tag with extended options (payload, TTL)
 */
export async function assignTagExtended(
  clientId: number,
  tagId: number,
  options?: { payload?: Record<string, unknown>; ttl_hours?: number; reason?: string }
): Promise<void> {
  await api.post(`/api/v1/clients/${clientId}/tags`, {
    tag_id: tagId,
    ...options,
  })
}

/**
 * Create tag with extended fields
 */
export async function createTagExtended(input: TagDefinitionCreate): Promise<Tag> {
  const response = await api.post<Tag>('/api/v1/tags', input)
  return response.data
}

/**
 * Get client tag operation history
 */
export async function getClientTagHistory(
  clientId: number,
  skip = 0,
  limit = 50
): Promise<TagAssignmentLog[]> {
  const response = await api.get<TagAssignmentLog[]>(`/api/v1/clients/${clientId}/tags/history`, {
    params: { skip, limit },
  })
  return response.data
}

/**
 * Get client state (aggregated from active tags)
 */
export async function getClientState(clientId: number): Promise<ClientState> {
  const response = await api.get<ClientState>(`/api/v1/tags/client/${clientId}/state`)
  return response.data
}

// --- Rules ---

export async function getRules(params?: {
  trigger_type?: string
  is_active?: boolean
}): Promise<TagRule[]> {
  const response = await api.get<TagRule[]>('/api/v1/rules', { params })
  return response.data
}

export async function getRule(id: number): Promise<TagRule> {
  const response = await api.get<TagRule>(`/api/v1/rules/${id}`)
  return response.data
}

export async function createRule(input: TagRuleCreate): Promise<TagRule> {
  const response = await api.post<TagRule>('/api/v1/rules', input)
  return response.data
}

export async function updateRule(id: number, input: TagRuleUpdate): Promise<TagRule> {
  const response = await api.put<TagRule>(`/api/v1/rules/${id}`, input)
  return response.data
}

export async function deleteRule(id: number): Promise<void> {
  await api.delete(`/api/v1/rules/${id}`)
}

// --- Removal Requests ---

export async function requestTagRemoval(
  clientId: number,
  tagId: number,
  reason?: string
): Promise<{ status: string; message: string }> {
  const response = await api.post<{ status: string; message: string }>(
    `/api/v1/clients/${clientId}/tags/${tagId}/request-removal`,
    { reason }
  )
  return response.data
}

export async function getRemovalRequests(skip = 0, limit = 50): Promise<RemovalRequest[]> {
  const response = await api.get<RemovalRequest[]>('/api/v1/tags/removal-requests', {
    params: { skip, limit },
  })
  return response.data
}

export async function approveRemovalRequest(
  requestId: number,
  reason?: string
): Promise<{ status: string; message: string }> {
  const response = await api.post<{ status: string; message: string }>(
    `/api/v1/tags/removal-requests/${requestId}/approve`,
    { reason }
  )
  return response.data
}

export async function rejectRemovalRequest(
  requestId: number,
  reason?: string
): Promise<{ status: string; message: string }> {
  const response = await api.post<{ status: string; message: string }>(
    `/api/v1/tags/removal-requests/${requestId}/reject`,
    { reason }
  )
  return response.data
}

// --- Segments ---

export async function getSegments(params?: { is_active?: boolean }): Promise<Segment[]> {
  const response = await api.get<Segment[]>('/api/v1/segments', { params })
  return response.data
}

export async function getSegment(id: number): Promise<Segment> {
  const response = await api.get<Segment>(`/api/v1/segments/${id}`)
  return response.data
}

export async function createSegment(input: SegmentCreate): Promise<Segment> {
  const response = await api.post<Segment>('/api/v1/segments', input)
  return response.data
}

export async function updateSegment(id: number, input: SegmentUpdate): Promise<Segment> {
  const response = await api.put<Segment>(`/api/v1/segments/${id}`, input)
  return response.data
}

export async function deleteSegment(id: number): Promise<void> {
  await api.delete(`/api/v1/segments/${id}`)
}

export async function previewSegment(
  conditions: SegmentCreate['conditions']
): Promise<SegmentPreview> {
  const response = await api.post<SegmentPreview>('/api/v1/segments/preview', { conditions })
  return response.data
}

export async function refreshSegment(id: number): Promise<Segment> {
  const response = await api.post<Segment>(`/api/v1/segments/${id}/refresh`)
  return response.data
}

export async function getSegmentClients(
  id: number,
  skip = 0,
  limit = 50
): Promise<SegmentClientsPage> {
  const response = await api.get<SegmentClientsPage>(`/api/v1/segments/${id}/clients`, {
    params: { skip, limit },
  })
  return response.data
}

/**
 * Exported API object for easier importing
 */
export const tagsApi = {
  // Backward-compatible
  getTags,
  createTag,
  updateTag,
  deleteTag,
  getClientTags,
  assignClientTag,
  removeClientTag,
  bulkTagClients,
  // Extended
  createTagExtended,
  assignTagExtended,
  getClientTagHistory,
  getClientState,
  // Rules
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  // Segments
  getSegments,
  getSegment,
  createSegment,
  updateSegment,
  deleteSegment,
  previewSegment,
  refreshSegment,
  getSegmentClients,
  // Removal Requests
  requestTagRemoval,
  getRemovalRequests,
  approveRemovalRequest,
  rejectRemovalRequest,
}
