/**
 * Payment API Types
 * Matches backend payment service schemas
 */

export type PaymentMethod = 'bank_transfer' | 'online_gateway' | 'cash' | 'card' | 'other'

export type PaymentStatus = 'pending' | 'verified' | 'cancelled'

/**
 * KAN-507 controlled-vocabulary values written through the operator-facing
 * record / edit endpoints. The backend keeps `payment_type` Optional on the
 * wire for back-compat; the FE form makes it required.
 */
export type PaymentType = 'payment_by_rr' | 'partial_payment' | 'full_payment'

export const PAYMENT_TYPE_VALUES: readonly PaymentType[] = [
  'payment_by_rr',
  'partial_payment',
  'full_payment',
]

export interface Payment {
  id: number
  payment_number: string
  project_id: number
  project_name?: string
  client_id: number
  debt_contract_number?: string | null
  amount: string
  currency: string
  debt_before: string
  debt_after: string
  principal_paid: string
  interest_paid: string
  fees_paid: string
  penalty_paid: string
  fines_paid: string
  payment_method: PaymentMethod
  payment_method_details?: string
  payment_type?: PaymentType | null
  payment_comment?: string | null
  seller_name?: string
  status: PaymentStatus
  payment_date: string // ISO date string
  recorded_at: string | null // ISO datetime string — nullable for auto-created verified rows
  verified_at?: string // ISO datetime string
  completed_at?: string // ISO datetime string
  // Bank details
  bank_name?: string
  bank_account?: string
  bank_transaction_id?: string
  bank_reference?: string
  // Receipt
  payment_confirmation_date?: string | null // ISO date — bank confirmation date
  receipt_number?: string
  receipt_url?: string
  receipt_generated_at?: string
  receipt_sent_at?: string
  receipt_sent_to?: string
  // Notes
  notes?: string
  internal_notes?: string
  // Related records
  related_call_id?: number
  payment_plan_id?: number
  installment_id?: number
  debt_id?: number
  // Recorded by
  recorded_by_user_id: number | null
  recorded_by_full_name?: string | null
  verified_by_user_id?: number
  verified_by_full_name?: string | null
  // Assigned operator — responsible user for this payment's collection
  assigned_user_id?: number | null
  assigned_user_full_name?: string | null
  // Reversal info
  reversed_at?: string
  reversed_by_user_id?: number
  reversal_reason?: string
  // Metadata
  created_at: string
  updated_at?: string
  // Soft delete
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: number
  // H-5: verify-time allocation snapshot. Populated by the BE on the
  // ``POST /payments/{id}/verify`` response when the payment has been
  // snapshotted. ``null``/missing for legacy rows and for responses
  // from non-verify endpoints (those callers should read
  // ``/debt-breakdown`` instead). Type extension only — no consumer
  // change required in this iteration.
  allocation_at?: string | null
  allocation?: {
    principal: number
    interest: number
    fees: number
    penalties: number
    fines: number
    allocated_total: number
    unmatched: number
  } | null
}

export interface RecordPaymentRequest {
  client_id: number
  debt_id?: number
  // Optional Restructuring Agreement earmark (Design 3). When set, the
  // payment is tied to that RR's schedule and counts toward its
  // auto-completion. When null/omitted, it's a "general" debt payment
  // with no RR earmarking — still reduces displayed total_to_return.
  restructuring_agreement_id?: number
  amount: number
  payment_date: string // ISO date string (YYYY-MM-DD)
  payment_method: PaymentMethod
  payment_method_details?: string
  bank_reference?: string
  notes?: string
  internal_notes?: string
  bank_name?: string
  bank_account?: string
  bank_transaction_id?: string
  related_call_id?: number
  payment_plan_id?: number
  installment_id?: number
  /**
   * KAN-507 controlled value. Required at the FE form layer; backend keeps it
   * Optional on the wire for back-compat. When the picked debt has an open RR,
   * the form auto-pre-fills `payment_by_rr` (operator can override).
   */
  payment_type?: PaymentType
}

export interface VerifyPaymentRequest {
  notes?: string
}

export interface CancelPaymentRequest {
  cancellation_reason: string
}

export interface EditPaymentRequest {
  amount?: number
  payment_method?: PaymentMethod
  /** KAN-507 controlled value; backend rejects anything outside the enum. */
  payment_type?: PaymentType
  payment_method_details?: string
  bank_reference?: string
  notes?: string
  internal_notes?: string
  bank_name?: string
  bank_account?: string
  bank_transaction_id?: string
}

export interface ReassignAssignedUserRequest {
  assigned_user_id: number
}

export interface PaymentListParams {
  page?: number
  limit?: number
  status?: PaymentStatus
  payment_method?: PaymentMethod
  from_date?: string // ISO date string
  to_date?: string // ISO date string
  client_id?: number
}

export interface PaymentListResponse {
  payments: Payment[]
  total: number
  page: number
  limit: number
}

export interface ClientPaymentHistoryParams {
  client_id: number
  page?: number
  limit?: number
  status?: PaymentStatus
  payment_method?: PaymentMethod
  from_date?: string // ISO date string
  to_date?: string // ISO date string
  date_field?: 'payment_date' | 'recorded_at'
  tz?: string // IANA timezone for date boundaries when date_field=recorded_at
  // When true, exclude pre-acquisition (primary-creditor) payments so the list
  // and total_amount_paid show to-us payments only, matching the debt summary.
  exclude_pre_acquisition?: boolean
}

export interface ClientPaymentHistoryResponse {
  client_id: number
  total_payments: number
  total_amount_paid: string
  current_debt: string
  payments: Payment[]
  page: number
  limit: number
}

export interface PaymentStatsParams {
  from_date?: string // ISO date string
  to_date?: string // ISO date string
  status?: PaymentStatus
  payment_method?: PaymentMethod
  client_id?: number
}

export interface PaymentStatsResponse {
  total_payments: number
  total_amount: string
  average_payment: string
  largest_payment: string
  smallest_payment: string
  by_status: Record<string, { count: number; total: string }>
  by_method: Record<string, { count: number; total: string }>
  date_from?: string
  date_to?: string
}

export interface ReceiptResponse {
  receipt_number: string
  payment_number: string
  payment_id: number
  generated_at: string
  file_path?: string
  file_size?: number
}

export interface PendingPaymentItem {
  id: number
  payment_number: string
  client_id: number
  client_name?: string | null
  amount: string
  payment_method: PaymentMethod
  payment_date: string
  recorded_at: string
  days_pending: number
  /** User who recorded the payment (operator / fixation). */
  recorded_by_user_id?: number | null
}

export interface PendingPaymentResponse {
  items: PendingPaymentItem[]
}

// Payment Debt Breakdown
export interface PaymentAllocationItem {
  component: 'principal' | 'interest' | 'fees' | 'penalties' | 'fines'
  component_label: string
  original_amount: number
  allocated_amount: number
  remaining_balance: number
}

export interface PaymentDebtBreakdownResponse {
  payment_number: string
  payment_amount: number
  payment_status: string
  /** Optional — null/missing when the payment has no associated debt (AC-1b). */
  debt_id: number | null
  contract_number: string
  allocation: PaymentAllocationItem[]
  total_allocated: number
  /**
   * Per the payment-allocation-snapshot requirement (Phase 4): residue from
   * ``payment_amount - Σ(allocated_*)``. Frontend renders a defensive
   * "Unmatched / Overpayment" pseudo-row when this is > 0.01. Old backends
   * omit the field — treat as 0 (`unmatched ?? 0`).
   */
  unmatched?: number
  total_remaining_debt: number
  /**
   * - ``"stored"``: read from payment.allocated_* (Phase 3+).
   * - ``"computed"``: chronological replay (legacy rows; identical to today).
   * - ``"none"``: payment has no debt (debt_id_missing).
   */
  allocation_method: 'computed' | 'stored' | 'none'
  /**
   * Verify-time snapshot timestamp. Present for ``allocation_method === "stored"``;
   * ``null`` for legacy rows. The frontend treats either this or ``computed_at``
   * as the "last computed at" indicator.
   */
  allocation_at?: string | null
  computed_at: string
  /** AC-1b — when true, allocation is empty and the modal renders a placeholder. */
  debt_id_missing?: boolean
}
