/**
 * Project Management Types
 *
 * TypeScript types for project API responses and requests.
 * Updated: 2025-12-08 - Added new fields for UI enhancements
 */

export const PROJECT_CURRENCIES = ['UAH', 'EUR'] as const
export type ProjectCurrency = (typeof PROJECT_CURRENCIES)[number]
export const PROJECT_COUNTRIES = ['UA', 'ES'] as const
export type ProjectCountry = (typeof PROJECT_COUNTRIES)[number]

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
  currency?: ProjectCurrency
  country?: ProjectCountry

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
  currency?: ProjectCurrency
  country?: ProjectCountry

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
  currency?: ProjectCurrency
  country?: ProjectCountry

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

/* ── Calling window and holiday calendar (KAN-1107) ─────────────────────── */

/** ISO weekday numbers: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface CallingWindowConfig {
  enabled: boolean
  /** "HH:MM", inclusive. */
  start: string | null
  /** "HH:MM", exclusive — 20:45 means the last permitted moment is 20:44. */
  end: string | null
  /** null means every day is allowed. */
  weekdays: IsoWeekday[] | null
  timezone: string | null
  holiday_country: string | null
  holiday_subdivision: string | null
}

export type CallingWindowInput = CallingWindowConfig

export interface HolidayCountry {
  code: string
  name: string
}

export interface HolidayDate {
  holiday_date: string
  name: string | null
  /** 'computed' came from the package; 'manual' was added by an admin. */
  origin: 'computed' | 'manual'
}

export interface HolidayCalendar {
  year: number
  country: string
  subdivision: string | null
  source_version: string | null
  reviewed: boolean
  reviewed_at: string | null
  reviewed_by: number | null
  dates: HolidayDate[]
}
