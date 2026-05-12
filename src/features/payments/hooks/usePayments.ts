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
  getPaymentDebtBreakdown,
} from '../api/paymentApi'
import type {
  PaymentListParams,
  ClientPaymentHistoryParams,
  PaymentStatsParams,
  PendingPaymentResponse,
  PaymentDebtBreakdownResponse,
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
  options?: { enabled?: boolean; keepPreviousDataBetweenFetches?: boolean }
) {
  return useQuery({
    queryKey: ['client-payment-history', params],
    queryFn: () => getClientPaymentHistory(params),
    enabled: options?.enabled !== false && !!params.client_id,
    placeholderData: (previousData, previousQuery) => {
      if (!options?.keepPreviousDataBetweenFetches || !previousData || !previousQuery) {
        return undefined
      }
      const prevParams = previousQuery.queryKey[1] as ClientPaymentHistoryParams | undefined
      if (!prevParams || prevParams.client_id !== params.client_id) {
        return undefined
      }
      return previousData
    },
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
 * Get payment debt component breakdown
 */
export function usePaymentDebtBreakdown(paymentId: string | null, options?: { enabled?: boolean }) {
  return useQuery<PaymentDebtBreakdownResponse>({
    queryKey: ['payment-debt-breakdown', paymentId],
    queryFn: () => getPaymentDebtBreakdown(paymentId!),
    enabled: options?.enabled !== false && !!paymentId,
    staleTime: 60_000,
  })
}

/**
 * Pending payments that exceeded the verification SLA (days).
 * Enabled only for users with edit_client_debt. By default the API returns only
 * payments recorded by the current user (My Tasks / operator fixation).
 */
export function usePendingVerificationPayments(
  params: { days?: number; only_recorded_by_me?: boolean } = {}
) {
  const canViewPending = useHasPermission(PERMISSIONS.CLIENTS.EDIT_DEBT)
  const queryParams = { only_recorded_by_me: true, ...params }
  return useQuery<PendingPaymentResponse>({
    queryKey: ['payments', 'pending-verifications', queryParams],
    queryFn: () => getPendingVerificationPayments(queryParams),
    enabled: canViewPending,
    refetchInterval: canViewPending ? 60_000 : false,
    staleTime: 30_000,
  })
}
