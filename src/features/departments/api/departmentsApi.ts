/**
 * Department API
 * API client for department operations
 */

import api from '@/lib/api'
import type {
  Department,
  DepartmentResponse,
  DepartmentFilters,
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from '../types'

/**
 * Fetch paginated list of departments
 */
export async function getDepartments(filters: DepartmentFilters = {}): Promise<DepartmentResponse> {
  const response = await api.get<DepartmentResponse>('/api/v1/admin/departments', {
    params: filters,
  })
  return response.data
}

/**
 * Fetch a single department by ID
 */
export async function getDepartment(id: number): Promise<Department> {
  const response = await api.get<Department>(`/api/v1/admin/departments/${id}`)
  return response.data
}

/**
 * Create a new department
 */
export async function createDepartment(data: CreateDepartmentInput): Promise<Department> {
  const response = await api.post<Department>('/api/v1/admin/departments', data)
  return response.data
}

/**
 * Update an existing department
 */
export async function updateDepartment(
  id: number,
  data: UpdateDepartmentInput
): Promise<Department> {
  const response = await api.put<Department>(`/api/v1/admin/departments/${id}`, data)
  return response.data
}

/**
 * Archive (soft delete) a department
 */
export async function archiveDepartment(id: number): Promise<void> {
  await api.delete(`/api/v1/admin/departments/${id}`)
}

export const departmentsApi = {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  archiveDepartment,
}
