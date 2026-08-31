/**
 * Users API Tests
 *
 * TDD RED phase: Tests written BEFORE implementation
 * Tests for all user CRUD operations
 */

import axios from 'axios'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usersApi } from '../api/usersApi'
import type { UserListParams, CreateUserInput, UpdateUserInput } from '../types'

// Mock the API client
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '@/lib/api'

describe('usersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUsers', () => {
    it('should fetch paginated users list with default parameters', async () => {
      const mockResponse = {
        data: {
          users: [
            {
              id: 1,
              username: 'john.doe',
              email: 'john@example.com',
              first_name: 'John',
              last_name: 'Doe',
              language: 'en',
              timezone: 'UTC',
              status: 'active',
              must_change_password: false,
              failed_login_attempts: 0,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            page_size: 10,
            total_count: 1,
            total_pages: 1,
          },
        },
      }

      vi.mocked(api.get).mockResolvedValueOnce(mockResponse)

      const result = await usersApi.getUsers()

      expect(api.get).toHaveBeenCalledWith('/api/v1/admin/users', {
        params: {},
        paramsSerializer: { indexes: null },
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should fetch users with custom parameters', async () => {
      const params: UserListParams = {
        page: 2,
        page_size: 20,
        status: 'active',
        search: 'john',
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: { users: [], pagination: {} } })

      await usersApi.getUsers(params)

      expect(api.get).toHaveBeenCalledWith('/api/v1/admin/users', {
        params,
        paramsSerializer: { indexes: null },
      })
    })

    it('should handle API errors', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))

      await expect(usersApi.getUsers()).rejects.toThrow('Network error')
    })

    it('sends several departments as a repeated key the list endpoint reads', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { users: [], pagination: {} } })

      await usersApi.getUsers({ department_ids: [4, 2] })

      const [url, config] = vi.mocked(api.get).mock.calls[0]
      const requested = axios.getUri({ url, ...config })

      expect(requested).toBe('/api/v1/admin/users?department_ids=4&department_ids=2')
    })

    it('leaves the department key off the request when nothing is selected', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { users: [], pagination: {} } })

      await usersApi.getUsers({ page: 1, department_ids: undefined })

      const [url, config] = vi.mocked(api.get).mock.calls[0]

      expect(axios.getUri({ url, ...config })).toBe('/api/v1/admin/users?page=1')
    })
  })

  describe('getUser', () => {
    it('should fetch single user by ID', async () => {
      const mockUser = {
        id: 1,
        username: 'john.doe',
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        language: 'en',
        timezone: 'UTC',
        status: 'active',
        must_change_password: false,
        failed_login_attempts: 0,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        projects: [
          {
            project_id: 1,
            project_name: 'Project A',
            project_code: 'PROJ_A',
            role_id: 1,
            role_name: 'Admin',
          },
        ],
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockUser })

      const result = await usersApi.getUser(1)

      expect(api.get).toHaveBeenCalledWith('/api/v1/admin/users/1')
      expect(result).toEqual(mockUser)
    })
  })

  describe('createUser', () => {
    it('should create a new user', async () => {
      const input: CreateUserInput = {
        username: 'jane.smith',
        email: 'jane@example.com',
        password: 'SecurePass123!',
        first_name: 'Jane',
        last_name: 'Smith',
        language: 'en',
        timezone: 'UTC',
        must_change_password: true,
        project_assignments: [
          { project_id: 1, role_id: 2 },
          { project_id: 2, role_id: 3 },
        ],
      }

      const mockResponse = {
        id: 2,
        ...input,
        password: undefined, // Password not returned
        status: 'active',
        failed_login_attempts: 0,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await usersApi.createUser(input)

      expect(api.post).toHaveBeenCalledWith('/api/v1/admin/users', input)
      expect(result).toEqual(mockResponse)
    })

    it('should handle validation errors', async () => {
      const input: CreateUserInput = {
        username: '',
        email: 'invalid-email',
        password: '123',
        first_name: '',
        last_name: '',
        language: 'en',
        timezone: 'UTC',
        must_change_password: false,
        project_assignments: [{ project_id: 1, role_id: 1 }],
      }

      vi.mocked(api.post).mockRejectedValueOnce({
        response: {
          status: 422,
          data: { detail: 'Validation failed' },
        },
      })

      await expect(usersApi.createUser(input)).rejects.toMatchObject({
        response: { status: 422 },
      })
    })
  })

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const userId = 1
      const input: UpdateUserInput = {
        first_name: 'John',
        last_name: 'Smith',
        email: 'john.smith@example.com',
      }

      const mockResponse = {
        id: userId,
        username: 'john.doe',
        ...input,
        language: 'en',
        timezone: 'UTC',
        status: 'active',
        must_change_password: false,
        failed_login_attempts: 0,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      }

      vi.mocked(api.put).mockResolvedValueOnce({ data: mockResponse })

      const result = await usersApi.updateUser(userId, input)

      expect(api.put).toHaveBeenCalledWith(`/api/v1/admin/users/${userId}`, input)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deactivateUser', () => {
    it('should deactivate a user', async () => {
      const userId = 1

      vi.mocked(api.post).mockResolvedValueOnce({
        data: { success: true, message: 'User deactivated successfully' },
      })

      const result = await usersApi.deactivateUser(userId)

      expect(api.post).toHaveBeenCalledWith(`/api/v1/admin/users/${userId}/deactivate`)
      expect(result).toEqual({ success: true, message: 'User deactivated successfully' })
    })
  })

  describe('reactivateUser', () => {
    it('should reactivate a user', async () => {
      const userId = 1

      vi.mocked(api.post).mockResolvedValueOnce({
        data: { success: true, message: 'User reactivated successfully' },
      })

      const result = await usersApi.reactivateUser(userId)

      expect(api.post).toHaveBeenCalledWith(`/api/v1/admin/users/${userId}/reactivate`)
      expect(result).toEqual({ success: true, message: 'User reactivated successfully' })
    })
  })

  describe('resetPassword', () => {
    it('should reset user password and return temporary password', async () => {
      const userId = 1
      const mockResponse = {
        success: true,
        message: 'Password reset successfully',
        temporary_password: 'TempPass123!',
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await usersApi.resetPassword(userId)

      expect(api.post).toHaveBeenCalledWith(`/api/v1/admin/users/${userId}/reset-password`)
      expect(result).toEqual(mockResponse)
      expect(result.temporary_password).toBeDefined()
    })
  })

  describe('unlockAccount', () => {
    it('should unlock a locked user account', async () => {
      const userId = 1
      const mockResponse = {
        success: true,
        message: 'Account unlocked successfully',
        username: 'john.doe',
        unlocked_by: 'admin',
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await usersApi.unlockAccount(userId)

      expect(api.post).toHaveBeenCalledWith(`/api/v1/admin/users/${userId}/unlock`)
      expect(result).toEqual(mockResponse)
    })

    it('should handle errors when account is not locked', async () => {
      const userId = 1

      vi.mocked(api.post).mockRejectedValueOnce({
        response: {
          status: 400,
          data: { detail: 'Account is not locked' },
        },
      })

      await expect(usersApi.unlockAccount(userId)).rejects.toMatchObject({
        response: { status: 400 },
      })
    })
  })
})
