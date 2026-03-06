/**
 * Payment Query Hooks
 * React Query hooks for fetching payment data
 */

import { useQuery } from '@tanstack/react-query'
import { useHasPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import {
  getPayment,
  getPayments,
  getClientPaymentHistory,
  getPaymentStats,
  getPendingVerificationPayments,
} from '../api/paymentApi'
import type {
  PaymentListParams,
  ClientPaymentHistoryParams,
  PaymentStatsParams,
  PendingPaymentResponse,
} from '../api/types'

/**
 * Get payment by ID
 */
export function usePayment(paymentId: string | number | null, enabled = true) {
  return useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => getPayment(paymentId!),
    enabled: enabled && paymentId !== null,
  })
}

/**
 * Get list of payments with filters
 */
export function usePayments(params: PaymentListParams = {}) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => getPayments(params),
  })
}

/**
 * Get client payment history
 */
export function useClientPaymentHistory(
  params: ClientPaymentHistoryParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['client-payment-history', params],
    queryFn: () => getClientPaymentHistory(params),
    enabled: options?.enabled !== false && !!params.client_id,
  })
}

/**
 * Get payment statistics
 */
export function usePaymentStats(params: PaymentStatsParams = {}) {
  return useQuery({
    queryKey: ['payment-stats', params],
    queryFn: () => getPaymentStats(params),
  })
}

/**
 * Get pending verification payments (bell notifications)
 * Only fires if user has edit_client_debt — Operators see pending payments,
 * Supervisors do NOT. Admins also see it (superuser).
 */
export function usePendingVerificationPayments(params: { days?: number } = {}) {
  const canViewPending = useHasPermission(PERMISSIONS.CLIENTS.EDIT_DEBT)
  return useQuery<PendingPaymentResponse>({
    queryKey: ['payments', 'pending-verifications', params],
    queryFn: () => getPendingVerificationPayments(params),
    enabled: canViewPending,
    refetchInterval: canViewPending ? 60_000 : false,
    staleTime: 30_000,
  })
}
