/**
 * TypeScript types for the payment reversal / storno feature (KAN-334).
 *
 * Mirrors the backend Pydantic schemas in
 * services/payment/app/schemas/reversal.py.
 *
 * All monetary amounts are STRINGS on the wire (Decimal-preserving), matching
 * the rest of the payment feature (`Payment.amount` is a string). Format for
 * display via `formatMoneyUAHTwoDecimals(Number(x))`.
 */

// The 5 user-facing charge types, in the modal's canonical order.
export const REVERSAL_CHARGE_TYPES = [
  'principal',
  'interest',
  'fine',
  'penalty',
  'commission',
] as const

export type ReversalChargeType = (typeof REVERSAL_CHARGE_TYPES)[number]

// --- Request shapes ---

export interface CreateReversalRequest {
  payment_id: number
  /** NEW allocation per charge type (decimal strings). Σ must equal payment amount. */
  principal: string
  interest: string
  fine: string
  penalty: string
  commission: string
  /** ISO date (YYYY-MM-DD). Defaults to today on the server when omitted. */
  reversal_date?: string | null
  comment?: string | null
}

export interface BulkReversalItem {
  payment_id: number
  principal: string
  interest: string
  fine: string
  penalty: string
  commission: string
}

export interface BulkReversalRequest {
  reversal_date?: string | null
  comment?: string | null
  items: BulkReversalItem[]
}

// --- Response shapes ---

export interface ReversalRow {
  id: number
  charge_type: ReversalChargeType
  /** Negative delta (original allocation removed). */
  storno_amount: string
  /** Positive delta (new allocation applied). */
  new_amount: string
}

/** One reversal operation, grouped across its charge-type rows. */
export interface Reversal {
  reversal_group_id: string
  original_payment_id: number
  payment_number?: string | null
  credit_id: number
  client_id: number
  client_full_name?: string | null
  reversal_date: string
  user_id?: number | null
  user_full_name?: string | null
  comment?: string | null
  created_at: string
  // Net change per charge type (new − original).
  principal: string
  interest: string
  fine: string
  penalty: string
  commission: string
  rows: ReversalRow[]
}

export interface ReversalListParams {
  client_id?: number
  debt_id?: number
  payment_id?: number
}

export interface ReversalListResponse {
  items: Reversal[]
  total: number
}

export interface BulkReversalResultItem {
  row_index: number
  payment_id: number
  reversal_group_id?: string | null
  status: 'success' | 'failed'
  error?: string | null
  error_code?: string | null
}

export interface BulkReversalResponse {
  processed: number
  success: number
  failed: number
  results: BulkReversalResultItem[]
  failures: BulkReversalResultItem[]
}

// --- Error shapes ---

/** Stable backend error codes (services/payment/app/services/reversal_service.py). */
export type ReversalErrorCode =
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_NOT_VERIFIED'
  | 'PAYMENT_HAS_NO_CREDIT'
  | 'ALREADY_REVERSED'
  | 'REVERSAL_NOT_SNAPSHOTTED'
  | 'AMOUNTS_SUM_MISMATCH'

export interface ReversalFieldError {
  code: ReversalErrorCode | string
  message?: string
  field?: string
  requested?: string
  expected?: string
  payment_id?: number
  [key: string]: unknown
}

export interface ReversalValidationErrorResponse {
  detail: 'Validation failed'
  errors: ReversalFieldError[]
}
