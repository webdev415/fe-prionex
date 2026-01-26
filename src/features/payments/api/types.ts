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
  client_id: number
  amount: number
  currency: string
  debt_before: number
  debt_after: number
  principal_paid: number
  interest_paid: number
  fees_paid: number
  penalty_paid: number
  fines_paid: number
  payment_method: PaymentMethod
  payment_method_details?: string
  status: PaymentStatus
  payment_date: string // ISO date string
  recorded_at: string // ISO datetime string
  verified_at?: string // ISO datetime string
  completed_at?: string // ISO datetime string
  // Bank details
  bank_name?: string
  bank_account?: string
  bank_transaction_id?: string
  bank_reference?: string
  // Receipt
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
  // Recorded by
  recorded_by_user_id: number
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
}

export interface ClientPaymentHistoryResponse {
  client_id: number
  total_payments: number
  total_amount_paid: number
  current_debt: number
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
  total_amount: number
  average_payment: number
  largest_payment: number
  smallest_payment: number
  by_status: Record<string, { count: number; total: number }>
  by_method: Record<string, { count: number; total: number }>
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
