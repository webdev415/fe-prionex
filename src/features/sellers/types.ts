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

  // Audit fields
  created_at: string
  updated_at: string
  created_by?: number
  updated_by?: number
}

/**
 * Seller statistics for detail view
 */
export interface SellerStatistics {
  total_debts: number
  total_debt_amount: number
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
}

/**
 * Seller detail response (alias for SellerDetail)
 */
export type SellerDetailResponse = SellerDetail
