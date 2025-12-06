/**
 * Roles API
 *
 * API functions for role CRUD operations and permissions.
 */

import api from '@/lib/api'
import type {
  RoleListResponse,
  RoleListParams,
  RoleDetailResponse,
  CreateRoleInput,
  UpdateRoleInput,
  PermissionsResponse,
} from '../types'

/**
 * Fetch paginated list of roles
 */
export async function getRoles(params: RoleListParams = {}): Promise<RoleListResponse> {
  const response = await api.get<RoleListResponse>('/api/v1/admin/roles', { params })
  return response.data
}

/**
 * Fetch a single role by ID
 */
export async function getRole(roleId: number): Promise<RoleDetailResponse> {
  const response = await api.get<RoleDetailResponse>(`/api/v1/admin/roles/${roleId}`)
  return response.data
}

/**
 * Create a new role
 */
export async function createRole(data: CreateRoleInput): Promise<RoleDetailResponse> {
  const response = await api.post<RoleDetailResponse>('/api/v1/admin/roles', data)
  return response.data
}

/**
 * Update an existing role
 */
export async function updateRole(
  roleId: number,
  data: UpdateRoleInput
): Promise<RoleDetailResponse> {
  const response = await api.put<RoleDetailResponse>(`/api/v1/admin/roles/${roleId}`, data)
  return response.data
}

/**
 * Delete a role
 */
export async function deleteRole(roleId: number): Promise<void> {
  await api.delete(`/api/v1/admin/roles/${roleId}`)
}

/**
 * Fetch all available permissions
 */
export async function getPermissions(): Promise<PermissionsResponse> {
  const response = await api.get<PermissionsResponse>('/api/v1/admin/permissions')
  return response.data
}

export const rolesApi = {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
}
