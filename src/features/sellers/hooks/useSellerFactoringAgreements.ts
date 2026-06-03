/**
 * useSellerFactoringAgreements Hook
 *
 * Fetches the list of factoring agreements for a seller.
 *
 * Two modes (controlled by `options.includeEmpty`):
 * - Default (`includeEmpty: false`) — seller-card view; BE scopes results
 *   to the caller's active project via the agreement → debts → clients
 *   chain and excludes agreements with zero debts.
 * - `includeEmpty: true` — import-wizard view; includes empty agreements
 *   and returns all agreements for the seller globally (agreements are
 *   seller-scoped, not project-scoped).
 */

import { useQuery } from '@tanstack/react-query'
import { sellersApi } from '../api/sellersApi'
import { sellersKeys } from './useSellers'

interface UseSellerFactoringAgreementsOptions {
  includeEmpty?: boolean
}

export function useSellerFactoringAgreements(
  sellerId: number | undefined | null,
  options: UseSellerFactoringAgreementsOptions = {}
) {
  const { includeEmpty = false } = options
  return useQuery({
    queryKey: [
      ...sellersKeys.detail(sellerId ?? 0),
      'factoring-agreements',
      { includeEmpty },
    ] as const,
    queryFn: () => sellersApi.listFactoringAgreements(sellerId as number, { includeEmpty }),
    enabled: typeof sellerId === 'number' && sellerId > 0,
    staleTime: 60 * 1000,
  })
}
