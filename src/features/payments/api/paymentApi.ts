/**
 * Payment API Service
 * All payment-related API calls go through Kong on port 8000
 */

import api from '@/lib/api'
import type {
  RecordPaymentRequest,
  Payment,
  VerifyPaymentRequest,
  CancelPaymentRequest,
  EditPaymentRequest,
  ReassignAssignedUserRequest,
  PaymentListParams,
  PaymentListResponse,
  ClientPaymentHistoryParams,
  ClientPaymentHistoryResponse,
  PaymentStatsParams,
  PaymentStatsResponse,
  PendingPaymentResponse,
  ReceiptResponse,
  PaymentDebtBreakdownResponse,
} from './types'

const BASE_URL = '/api/v1/payments'

/**
 * Record a new payment
 */
export async function recordPayment(request: RecordPaymentRequest): Promise<Payment> {
  const response = await api.post<Payment>(BASE_URL, request)
  return response.data
}

/**
 * Get payment by ID
 */
export async function getPayment(paymentId: string | number): Promise<Payment> {
  const response = await api.get<Payment>(`${BASE_URL}/${paymentId}`)
  return response.data
}

/**
 * Verify a payment
 */
export async function verifyPayment(
  paymentId: string | number,
  request: VerifyPaymentRequest = {}
): Promise<Payment> {
  const response = await api.post<Payment>(`${BASE_URL}/${paymentId}/verify`, request)
  return response.data
}

/**
 * Cancel a payment
 */
export async function cancelPayment(
  paymentId: string | number,
  request: CancelPaymentRequest
): Promise<Payment> {
  const response = await api.delete<Payment>(`${BASE_URL}/${paymentId}`, {
    data: request,
  })
  return response.data
}

/**
 * Edit a payment
 */
export async function editPayment(
  paymentId: number,
  request: EditPaymentRequest
): Promise<Payment> {
  const response = await api.put<Payment>(`${BASE_URL}/${paymentId}`, request)
  return response.data
}

/**
 * Reassign the assigned operator on a verified payment.
 * Requires verify_payment permission server-side.
 */
export async function reassignPaymentAssignedUser(
  paymentId: number,
  request: ReassignAssignedUserRequest
): Promise<Payment> {
  const response = await api.patch<Payment>(`${BASE_URL}/${paymentId}/assigned-user`, request)
  return response.data
}

/**
 * Get list of payments with filters
 */
export async function getPayments(params: PaymentListParams = {}): Promise<PaymentListResponse> {
  const response = await api.get<PaymentListResponse>(BASE_URL, { params })
  return response.data
}

/**
 * Get client payment history
 */
export async function getClientPaymentHistory(
  params: ClientPaymentHistoryParams
): Promise<ClientPaymentHistoryResponse> {
  const response = await api.get<ClientPaymentHistoryResponse>(
    `${BASE_URL}/client/${params.client_id}`,
    {
      params: {
        page: params.page,
        limit: params.limit,
        status: params.status,
        payment_method: params.payment_method,
        from_date: params.from_date,
        to_date: params.to_date,
        date_field: params.date_field,
        tz: params.tz,
      },
    }
  )
  return response.data
}

/**
 * Get payment statistics
 */
export async function getPaymentStats(
  params: PaymentStatsParams = {}
): Promise<PaymentStatsResponse> {
  const response = await api.get<PaymentStatsResponse>(`${BASE_URL}/stats`, { params })
  return response.data
}

/**
 * Generate payment receipt
 * @param paymentId Payment ID
 * @param format 'pdf' (default) returns blob, 'json' returns ReceiptResponse
 */
export async function generateReceipt(
  paymentId: string | number,
  format: 'pdf' | 'json' = 'pdf'
): Promise<Blob | ReceiptResponse> {
  if (format === 'pdf') {
    const response = await api.get(`${BASE_URL}/receipt/${paymentId}`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    })
    return response.data
  } else {
    const response = await api.get<ReceiptResponse>(`${BASE_URL}/receipt/${paymentId}`, {
      params: { format: 'json' },
    })
    return response.data
  }
}

/**
 * Export payments to CSV
 */
export async function exportPaymentsCSV(params: PaymentListParams = {}): Promise<Blob> {
  const response = await api.get(`${BASE_URL}/export`, {
    params,
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get payment debt component breakdown
 */
export async function getPaymentDebtBreakdown(
  paymentId: string
): Promise<PaymentDebtBreakdownResponse> {
  const response = await api.get<PaymentDebtBreakdownResponse>(
    `${BASE_URL}/${paymentId}/debt-breakdown`
  )
  return response.data
}

/**
 * Get pending verification payments (bell notifications)
 */
export async function getPendingVerificationPayments(
  params: { days?: number; only_recorded_by_me?: boolean } = {}
): Promise<PendingPaymentResponse> {
  const response = await api.get<PendingPaymentResponse>(`${BASE_URL}/pending-verifications`, {
    params,
  })
  return response.data
}
