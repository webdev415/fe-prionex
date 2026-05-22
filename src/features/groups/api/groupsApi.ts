/**
 * Group API
 */

import api from '@/lib/api'
import type {
  Group,
  GroupFilters,
  GroupListResponse,
  CreateGroupInput,
  UpdateGroupInput,
} from '../types'

export async function getGroups(filters: GroupFilters = {}): Promise<GroupListResponse> {
  const response = await api.get<GroupListResponse>('/api/v1/admin/groups', { params: filters })
  return response.data
}

export async function getGroup(id: number): Promise<Group> {
  const response = await api.get<Group>(`/api/v1/admin/groups/${id}`)
  return response.data
}

export async function createGroup(data: CreateGroupInput): Promise<Group> {
  const response = await api.post<Group>('/api/v1/admin/groups', data)
  return response.data
}

export async function updateGroup(id: number, data: UpdateGroupInput): Promise<Group> {
  const response = await api.put<Group>(`/api/v1/admin/groups/${id}`, data)
  return response.data
}

export async function archiveGroup(id: number): Promise<void> {
  await api.delete(`/api/v1/admin/groups/${id}`)
}

export const groupsApi = {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  archiveGroup,
}
