/**
 * Department Types
 * Types for department management feature
 */

export interface Department {
  id: number
  project_id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  assigned_roles_count?: number
  assigned_roles?: Array<{
    id: number
    name: string
  }>
}

export interface DepartmentFilters {
  page?: number
  page_size?: number
  project_id?: number
  is_active?: boolean
  search?: string
}

export interface DepartmentResponse {
  departments: Department[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface CreateDepartmentInput {
  project_id: number
  name: string
  description?: string
}

export interface UpdateDepartmentInput {
  name?: string
  description?: string
  is_active?: boolean
}
