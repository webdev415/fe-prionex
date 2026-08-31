/**
 * Users API Client
 *
 * API functions for user CRUD operations.
 * Implements all endpoints from auth-service /api/v1/admin/users.
 */

import api from '@/lib/api'
import type {
  ApiUser,
  CreateUserInput,
  IpWhitelistSettings,
  ResetPasswordResponse,
  UnlockAccountResponse,
  UpdateIpWhitelistSettingsInput,
  UpdateUserInput,
  UserDetailResponse,
  UserListParams,
  UserListResponse,
} from '../types'

/**
 * Fetch paginated users list
 *
 * @param params - Query parameters for filtering and pagination
 * @returns Paginated list of users
 */
export async function getUsers(params: UserListParams = {}): Promise<UserListResponse> {
  const response = await api.get<UserListResponse>('/api/v1/admin/users', {
    params,
    paramsSerializer: { indexes: null },
  })
  return response.data
}

/**
 * Fetch single user by ID with project assignments
 *
 * @param userId - User ID
 * @returns User detail with projects
 */
export async function getUser(userId: number): Promise<UserDetailResponse> {
  const response = await api.get<UserDetailResponse>(`/api/v1/admin/users/${userId}`)
  return response.data
}

/**
 * Create a new user
 *
 * @param input - User creation data
 * @returns Created user (without password)
 */
export async function createUser(input: CreateUserInput): Promise<ApiUser> {
  const response = await api.post<ApiUser>('/api/v1/admin/users', input)
  return response.data
}

/**
 * Update existing user
 *
 * @param userId - User ID
 * @param input - Fields to update
 * @returns Updated user
 */
export async function updateUser(userId: number, input: UpdateUserInput): Promise<ApiUser> {
  const response = await api.put<ApiUser>(`/api/v1/admin/users/${userId}`, input)
  return response.data
}

/**
 * Deactivate user account
 *
 * @param userId - User ID
 * @returns Success response
 */
export async function deactivateUser(
  userId: number
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}/deactivate`
  )
  return response.data
}

/**
 * Reactivate deactivated user account
 *
 * @param userId - User ID
 * @returns Success response
 */
export async function reactivateUser(
  userId: number
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}/reactivate`
  )
  return response.data
}

/**
 * Admin reset user password
 *
 * Sets password to the system default (hashed server-side); user must change it on next login.
 */
export async function resetPassword(userId: number): Promise<ResetPasswordResponse> {
  const response = await api.post<ResetPasswordResponse>(
    `/api/v1/admin/users/${userId}/reset-password`
  )
  return response.data
}

/**
 * Unlock user account after lockout (by user ID).
 *
 * Backend endpoint: POST /api/v1/admin/users/{user_id}/unlock
 */
export async function unlockAccount(userId: number): Promise<UnlockAccountResponse> {
  const response = await api.post<UnlockAccountResponse>(`/api/v1/admin/users/${userId}/unlock`)
  return response.data
}

/**
 * Admin soft-disable of a user's 2FA. The TOTP secret and unused backup codes
 * are preserved so re-enable doesn't require re-enrollment.
 */
export async function adminDisableTwoFactor(
  userId: number
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}/2fa/disable`
  )
  return response.data
}

/**
 * Admin re-enable of a user's 2FA using their preserved TOTP secret.
 * Backend rejects if the user never enrolled in 2FA themselves.
 */
export async function adminReenableTwoFactor(
  userId: number
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(
    `/api/v1/admin/users/${userId}/2fa/reenable`
  )
  return response.data
}

/**
 * Read the global IP-whitelist enforcement flag.
 *
 * When `enabled` is false the per-user whitelist is dormant; logins
 * succeed regardless of source IP.
 */
export async function getIpWhitelistSettings(): Promise<IpWhitelistSettings> {
  const response = await api.get<IpWhitelistSettings>('/api/v1/admin/settings/ip-whitelist')
  return response.data
}

/**
 * Toggle the global IP-whitelist enforcement flag.
 */
export async function updateIpWhitelistSettings(
  input: UpdateIpWhitelistSettingsInput
): Promise<IpWhitelistSettings> {
  const response = await api.put<IpWhitelistSettings>('/api/v1/admin/settings/ip-whitelist', input)
  return response.data
}

/**
 * Exported API object for easier importing
 */

export interface OperatorUser {
  id: number
  username: string
  full_name: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string
  status: string
  asterisk_extension?: string | null
  /** Operator hire / internship date (ISO 8601 yyyy-mm-dd). KAN-414. */
  hired_at?: string | null
  /** Role's department in the active project (operators list only). */
  department_id?: number | null
  department_name?: string | null
  /** Group (team) the operator belongs to in the active project. */
  group_id?: number | null
  group_name?: string | null
}

/**
 * Fetch active users for a project — accessible to ALL authenticated users.
 * Uses /api/v1/users/operators instead of the admin-only /api/v1/admin/users.
 */
export async function getOperators(
  projectId: number,
  status = 'active'
): Promise<{ operators: OperatorUser[] }> {
  const response = await api.get<{ operators: OperatorUser[] }>('/api/v1/users/operators', {
    params: { project_id: projectId, status },
  })
  return response.data
}

/**
 * Get the department name for a user in a project.
 * Uses the non-admin endpoint accessible to any authenticated user.
 */
export async function getUserDepartment(
  userId: number,
  projectId?: number
): Promise<{
  department_name: string | null
  department_id?: number | null
  group_name: string | null
  group_id?: number | null
}> {
  const response = await api.get<{
    department_name: string | null
    department_id?: number | null
    group_name: string | null
    group_id?: number | null
  }>(`/api/v1/users/${userId}/department`, { params: projectId ? { project_id: projectId } : {} })
  return response.data
}

export const usersApi = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetPassword,
  unlockAccount,
  adminDisableTwoFactor,
  adminReenableTwoFactor,
  getOperators,
  getUserDepartment,
  getIpWhitelistSettings,
  updateIpWhitelistSettings,
}
