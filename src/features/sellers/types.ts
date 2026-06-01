/**
 * Seller Management Types
 *
 * TypeScript types for seller API responses and requests.
 */

/**
 * Seller type enumeration
 */
export type SellerType =
  | 'bank'
  | 'mfo'
  | 'collection_agency'
  | 'retail'
  | 'telecom'
  | 'utilities'
  | 'other'

/**
 * Seller from API (list view)
 */
export interface Seller {
  id: number
  seller_code: string
  seller_name: string
  seller_type: SellerType
  is_active: boolean
  is_verified: boolean
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  tax_id?: string
  notes?: string

  /**
   * Full legal entity name of the primary creditor (KAN-557).
   * E.g., 'ТОВ "ФК "Є ГРОШІ"'. `seller_name` remains the operator-facing label.
   */
  legal_name?: string | null

  // Audit fields
  created_at: string
  updated_at: string
  created_by?: number
  updated_by?: number
}

/**
 * Factoring agreement — the contract under which the project purchased
 * a batch of debts (KAN-557).
 * Returned by GET /api/v1/sellers/{seller_id}/factoring-agreements.
 */
export interface FactoringAgreement {
  id: number
  seller_id: number
  agreement_number: string
  /**
   * Free-text name of the entity that actually sold the debts to the
   * project. May equal the seller's legal_name in the ~6% direct-sale case,
   * or be an intermediate reseller in the ~94% chain-sale case.
   */
  previous_lender?: string | null
  contract_purchase_date?: string | null
  created_at: string
  /** Count of debts (in the caller's project) linked to this agreement. */
  debt_count: number
}

/**
 * Seller statistics for detail view
 */
export interface SellerStatistics {
  total_debts: number
  total_debt_amount: string
  unique_clients: number
  active_debts: number
  paid_debts: number
  written_off_debts: number
}

/**
 * Seller detail from API (includes statistics)
 */
export interface SellerDetail extends Seller {
  statistics?: SellerStatistics
  // Backend fields that may be present in API response
  legal_address?: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
  secondary_contact_name?: string
  secondary_contact_email?: string
  secondary_contact_phone?: string
  registration_number?: string
  contract_start_date?: string
  contract_end_date?: string
}

/**
 * Paginated seller list response
 */
export interface SellerListResponse {
  sellers: Seller[]
  total: number
  page: number
  page_size: number
}

/**
 * Seller filters for search
 */
export interface SellerFilters {
  search?: string
  seller_type?: SellerType
  is_active?: boolean
  project_id?: number
}

/**
 * Seller list query parameters
 */
export interface SellerListParams extends SellerFilters {
  skip?: number
  limit?: number
}

/**
 * Create seller input
 */
export interface CreateSellerInput {
  seller_code: string
  seller_name: string
  seller_type: SellerType
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  tax_id?: string
  notes?: string
  is_active?: boolean
}

/**
 * Update seller input (all fields optional)
 */
export interface UpdateSellerInput {
  seller_name?: string
  seller_type?: SellerType
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  tax_id?: string
  notes?: string
  is_active?: boolean
  /** Full legal entity name of the primary creditor (KAN-557). */
  legal_name?: string | null
}

/**
 * Seller detail response (alias for SellerDetail)
 */
export type SellerDetailResponse = SellerDetail
