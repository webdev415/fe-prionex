/**
 * Users API Client
 *
 * API functions for user CRUD operations.
 * Implements all endpoints from auth-service /api/v1/admin/users.
 */

import api from '@/lib/api'
import type {
  ApiUser,
  UserListParams,
  UserListResponse,
  UserDetailResponse,
  CreateUserInput,
  UpdateUserInput,
  ResetPasswordResponse,
  UnlockAccountResponse,
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
 * Reset user password
 *
 * Generates a temporary password and forces user to change it on next login.
 *
 * @param userId - User ID
 * @returns Temporary password to provide to user
 */
export async function resetPassword(userId: number): Promise<ResetPasswordResponse> {
  const response = await api.post<ResetPasswordResponse>(
    `/api/v1/admin/users/${userId}/reset-password`
  )
  return response.data
}

/**
 * Unlock user account after lockout
 *
 * @param userId - User ID
 * @returns Unlock confirmation with username
 */
export async function unlockAccount(userId: number): Promise<UnlockAccountResponse> {
  const response = await api.post<UnlockAccountResponse>(`/api/v1/admin/users/${userId}/unlock`)
  return response.data
}

/**
 * Exported API object for easier importing
 */
export const usersApi = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetPassword,
  unlockAccount,
}
