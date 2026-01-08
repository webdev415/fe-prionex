/**
 * TypeScript types for Client API
 * Based on TIN-based brand isolation architecture
 */

export interface DebtDetail {
  id: number
  seller_company: string
  contract_number: string
  original_debt_amount: number
  remaining_debt_amount: number
  debt_currency?: string
  purchase_date?: string | null
  debt_start_date?: string | null
  debt_close_date?: string | null
  status: string
  total_paid?: number
  last_payment_date?: string | null
  last_payment_amount?: number | null
  debt_notes?: string | null
}

export interface Client {
  id: number
  project_id: number
  tax_id: string // Ukrainian TIN - MANDATORY
  phone_primary: string
  phone_secondary?: string | null
  first_name: string
  last_name: string
  middle_name?: string | null
  date_of_birth?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  region?: string | null
  postal_code?: string | null
  country?: string

  // Priority scoring (moved from client_projects)
  priority_score: number
  status: string

  // Manual priority override
  manual_priority?: string | null
  manual_priority_reason?: string | null

  // Contact tracking
  last_contact_date?: string | null
  last_contact_type?: string | null
  contact_count: number

  // Metadata
  source: string
  first_import_batch_id?: string | null
  legacy_id?: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean

  // Debt summary
  debt_count: number
  total_debt: number
  primary_creditor?: string | null
}

export interface ClientDetail extends Client {
  // Detailed debt list
  debts?: DebtDetail[]

  // Additional manual priority fields
  manual_priority_set_at?: string | null
  manual_priority_set_by?: number | null
}

export interface CreateClientRequest {
  phone_primary: string
  tax_id: string // MANDATORY
  first_name: string
  last_name: string
  middle_name?: string
  date_of_birth?: string
  phone_secondary?: string
  email?: string
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
}

export interface UpdateClientRequest {
  phone_primary?: string
  first_name?: string
  last_name?: string
  middle_name?: string
  date_of_birth?: string
  phone_secondary?: string
  email?: string
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  // Note: tax_id CANNOT be changed after creation
}

export interface GetClientsParams {
  // Pagination
  project_id?: number
  skip?: number
  limit?: number

  // Sorting
  sort_by_priority?: boolean // Legacy parameter
  sort_by?: 'priority_score' | 'created_at' | 'first_name' | 'last_name' | 'id'
  sort_order?: 'asc' | 'desc'

  // Filter: Portfolio/Sellers
  seller_ids?: string // Comma-separated seller IDs (e.g., "1,5,12")

  // Filter: Date Range
  sale_date_from?: string // YYYY-MM-DD format
  sale_date_to?: string // YYYY-MM-DD format

  // Filter: Assignment
  responsible_employee_id?: number
  responsible_searcher_id?: number
  unassigned_only?: boolean

  // Filter: Debt Amounts (legacy - remaining debt)
  debt_min?: number
  debt_max?: number

  // Filter: Principal Amount
  principal_min?: number
  principal_max?: number

  // Filter: Total Debt Amount
  total_debt_min?: number
  total_debt_max?: number

  // Filter: Days Past Due
  dpd_min?: number
  dpd_max?: number

  // Filter: Status
  status?: string // Comma-separated statuses (e.g., "active,new")
}

export interface ManualPriorityRequest {
  priority: 'high' | 'medium' | 'low' | 'excluded'
  reason: string
}

export interface SearchByTinParams {
  tin: string
  project_id?: number
}
