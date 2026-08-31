/**
 * Project Management Types
 *
 * TypeScript types for project API responses and requests.
 * Updated: 2025-12-08 - Added new fields for UI enhancements
 */

/**
 * Project from API (list view)
 */
export interface ApiProject {
  id: number
  name: string
  code: string
  description?: string
  status: 'active' | 'inactive' | 'archived'
  is_active: boolean

  // Client information
  client_company?: string
  contract_number?: string

  // Timeline
  start_date?: string
  end_date?: string

  // Company legal details
  full_company_name?: string | null
  address?: string | null
  edrpou_code?: string | null
  website?: string | null
  email?: string | null
  hotline_phone?: string | null
  director_name?: string | null

  // Banking details
  iban?: string | null
  bank_name?: string | null
  bank_code?: string | null

  // Metrics
  total_clients: number
  total_debt_amount: string

  // Counts
  user_count: number
  role_count: number

  // Audit
  created_at: string
  updated_at: string
  created_by?: {
    id: number
    username: string
    email?: string
  } | null

  settings?: Record<string, unknown>
}

/**
 * Project statistics for detail view
 */
export interface ProjectStatistics {
  user_count: number
  active_user_count: number
  role_count: number
  custom_role_count: number
}

/**
 * Role information for project detail
 */
export interface ProjectRole {
  id: number
  name: string
  is_default: boolean
  user_count: number
}

/**
 * Project detail from API (includes additional data)
 */
export interface ApiProjectDetail extends ApiProject {
  statistics: ProjectStatistics
  roles: ProjectRole[]
  default_roles: string[]
  assigned_users_count: number
}

/**
 * Paginated project list response
 */
export interface ProjectListResponse {
  projects: ApiProject[]
  pagination: {
    page: number
    page_size: number
    total_items: number
    total_pages: number
  }
}

/**
 * Project filters for search
 */
export interface ProjectFilters {
  search?: string
  status?: 'active' | 'inactive' | 'archived' | 'all'
  client_company?: string
  start_date_from?: string
  start_date_to?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

/**
 * Project list query parameters
 */
export interface ProjectListParams extends ProjectFilters {
  page?: number
  page_size?: number
}

/**
 * Create project input
 */
export interface CreateProjectInput {
  name: string
  code: string
  description?: string
  client_company?: string
  contract_number?: string
  start_date?: string
  end_date?: string

  // Company legal details — all optional
  full_company_name?: string | null
  address?: string | null
  edrpou_code?: string | null
  website?: string | null
  email?: string | null
  hotline_phone?: string | null
  director_name?: string | null

  // Banking details — all optional
  iban?: string | null
  bank_name?: string | null
  bank_code?: string | null
}

/**
 * Update project input
 */
export interface UpdateProjectInput {
  name?: string
  description?: string
  client_company?: string
  contract_number?: string
  start_date?: string
  end_date?: string
  status?: 'active' | 'inactive'

  // Company legal details — all optional
  full_company_name?: string | null
  address?: string | null
  edrpou_code?: string | null
  website?: string | null
  email?: string | null
  hotline_phone?: string | null
  director_name?: string | null

  // Banking details — all optional
  iban?: string | null
  bank_name?: string | null
  bank_code?: string | null
}

/**
 * Export parameters
 */
export interface ExportParams {
  format: 'csv' | 'xlsx'
  search?: string
  status?: string
  client_company?: string
}

/**
 * Project detail response (alias for ApiProjectDetail for backward compatibility)
 */
export type ProjectDetailResponse = ApiProjectDetail
