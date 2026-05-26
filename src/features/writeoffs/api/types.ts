/**
 * TypeScript types for the debt write-off feature (KAN-245).
 *
 * Mirrors the backend Pydantic schemas in
 * services/client/app/schemas/writeoff_entry.py.
 *
 * All monetary amounts arrive as STRINGS to preserve Decimal precision —
 * never `number`. Format for display via `formatMoneyUAHTwoDecimals`.
 */

// The 5 user-facing accrual types. Use this as the discriminator throughout
// the UI rather than ad-hoc string literals.
export const ACCRUAL_TYPES = ['principal', 'interest', 'penalty', 'fine', 'commission'] as const

export type AccrualType = (typeof ACCRUAL_TYPES)[number]

// --- Request shapes ---

/** One component slot in the create-modal form. */
export interface WriteoffComponentInput {
  /** Decimal string. "0" or empty = skip this component. */
  amount: string
  /** ISO date (YYYY-MM-DD). Required if amount > 0; ignored when amount is 0/empty. */
  cancellation_date: string | null
}

export interface CreateWriteoffRequest {
  components: Partial<Record<AccrualType, WriteoffComponentInput>>
  notes?: string | null
}

export interface UpdateWriteoffRequest {
  /** New future-dated cancellation date (ISO YYYY-MM-DD). */
  cancellation_date?: string
  /** New operator note. Empty string clears the field. */
  notes?: string
}

export interface CancelWriteoffRequest {
  /** Optional operator reason — recorded on the entry. */
  cancellation_reason?: string
}

// --- Response shapes ---

export interface WriteoffEntryCreator {
  user_id: number
  name?: string | null
}

export interface WriteoffEntry {
  id: number
  debt_id: number
  accrual_type: AccrualType
  /** Decimal string. */
  amount: string
  /** ISO date string. */
  cancellation_date: string
  /** ISO datetime string. */
  created_at: string
  created_by: WriteoffEntryCreator
  creation_source: 'individual'
  notes: string | null
  cancelled_at: string | null
  cancellation_source: 'manual' | 'auto' | null
  cancellation_actor: WriteoffEntryCreator | null
  cancellation_reason: string | null
  status: 'active' | 'cancelled'
}

export interface ListWriteoffsParams {
  status?: 'active' | 'cancelled' | 'all'
  accrual_type?: AccrualType
  page?: number
  page_size?: number
  created_after?: string
  created_before?: string
}

export interface PaginatedWriteoffsResponse {
  items: WriteoffEntry[]
  pagination: {
    page: number
    page_size: number
    total: number
  }
}

export interface CreateWriteoffResponse {
  entry_ids: number[]
  entries: WriteoffEntry[]
}

// --- Error shapes ---

/**
 * Stable backend error codes (REQUIREMENTS §6.4).
 *
 * Frontend i18n keys map 1:1 to these. The router-level
 * RequestValidationError mapper guarantees these codes for every
 * client-visible validation failure.
 */
export type WriteoffErrorCode =
  | 'CANCELLATION_DATE_IN_PAST'
  | 'AMOUNT_MUST_BE_POSITIVE'
  | 'NO_COMPONENTS_TO_WRITE_OFF'
  | 'DEBT_NOT_FOUND'
  | 'DEBT_NOT_OPEN'
  | 'INSUFFICIENT_BALANCE'
  | 'WRITEOFF_ALREADY_CANCELLED'
  | 'WRITEOFF_AMOUNT_IMMUTABLE'
  | 'WRITEOFF_ACCRUAL_TYPE_IMMUTABLE'
  | 'PERMISSION_DENIED'

export interface WriteoffFieldError {
  code: WriteoffErrorCode
  field?: string
  requested?: string
  available?: string
  value?: string
  today?: string
  debt_id?: number
  entry_id?: number
  /** Catch-all for any other contextual hint the backend attaches. */
  [key: string]: unknown
}

export interface WriteoffValidationErrorResponse {
  detail: 'Validation failed'
  errors: WriteoffFieldError[]
}
