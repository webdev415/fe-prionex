/**
 * Tags API Client
 *
 * API functions for tag CRUD operations.
 * Implements endpoints from tags-service /api/v1/tags.
 */

import api from '@/lib/api'
import type { Tag, TagCreate, TagUpdate } from '../types'

/**
 * Fetch tags list for a project
 *
 * @param projectId - Project ID to filter tags
 * @returns List of tags
 */
export async function getTags(projectId?: number): Promise<Tag[]> {
  const params = projectId ? { project_id: projectId } : {}
  const response = await api.get<Tag[]>('/api/v1/tags', { params })
  return response.data
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
export async function updateTag(id: number, input: TagUpdate): Promise<Tag> {
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
export async function getClientTags(clientId: number): Promise<Tag[]> {
  const response = await api.get<Tag[]>(`/api/v1/clients/${clientId}/tags`)
  return response.data
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

/**
 * Exported API object for easier importing
 */
export const tagsApi = {
  getTags,
  createTag,
  updateTag,
  deleteTag,
  getClientTags,
  assignClientTag,
  removeClientTag,
  bulkTagClients,
}
