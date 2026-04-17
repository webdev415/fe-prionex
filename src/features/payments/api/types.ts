/**
 * Payment API Types
 * Matches backend payment service schemas
 */

export type PaymentMethod = 'bank_transfer' | 'online_gateway' | 'cash' | 'card' | 'other'

export type PaymentStatus = 'pending' | 'verified' | 'cancelled'

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
  payment_type?: string
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
  recorded_by_username?: string
  verified_by_user_id?: number
  verified_by_username?: string
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
}

export interface RecordPaymentRequest {
  client_id: number
  debt_id?: number
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
  payment_method_details?: string
  bank_reference?: string
  notes?: string
  internal_notes?: string
  bank_name?: string
  bank_account?: string
  bank_transaction_id?: string
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
  debt_id: number
  contract_number: string
  allocation: PaymentAllocationItem[]
  total_allocated: number
  total_remaining_debt: number
  allocation_method: 'computed' | 'stored'
  computed_at: string
}
