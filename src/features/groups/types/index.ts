/**
 * Group Types
 */

export interface Group {
  id: number
  project_id: number
  department_id: number
  department_name?: string | null
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  assigned_operators_count?: number
}

export interface GroupFilters {
  page?: number
  page_size?: number
  project_id?: number
  department_id?: number
  is_active?: boolean
  search?: string
}

export interface GroupListResponse {
  groups: Group[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface CreateGroupInput {
  department_id: number
  name: string
  description?: string
}

export interface UpdateGroupInput {
  name?: string
  description?: string
  is_active?: boolean
}
