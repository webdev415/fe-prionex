/**
 * Fetches all verified payments for a client (paginated API, full history).
 */

import { useQuery } from '@tanstack/react-query'
import { getClientPaymentHistory } from '../api/paymentApi'
import type { Payment } from '../api/types'

const PAGE_LIMIT = 200

export async function fetchAllClientVerifiedPayments(clientId: number): Promise<Payment[]> {
  const all: Payment[] = []
  let page = 1
  let total = Infinity

  while (all.length < total) {
    const response = await getClientPaymentHistory({
      client_id: clientId,
      status: 'verified',
      page,
      limit: PAGE_LIMIT,
    })
    total = response.total_payments
    all.push(...response.payments)
    if (response.payments.length === 0) {
      break
    }
    page += 1
  }

  return all
}

export function useClientAllVerifiedPayments(clientId: number, enabled = true) {
  return useQuery({
    queryKey: ['client-all-verified-payments', clientId],
    queryFn: () => fetchAllClientVerifiedPayments(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 30_000,
  })
}
