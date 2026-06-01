/**
 * useSellerFactoringAgreements Hook (KAN-557)
 *
 * Fetches the list of factoring agreements for a seller, scoped server-side
 * to the caller's active project.
 */

import { useQuery } from '@tanstack/react-query'
import { sellersApi } from '../api/sellersApi'
import { sellersKeys } from './useSellers'

/**
 * Hook to fetch a seller's factoring agreements.
 *
 * Pass `enabled: false` style by passing `sellerId = undefined/null` — the
 * query stays disabled until a valid id is supplied.
 */
export function useSellerFactoringAgreements(sellerId: number | undefined | null) {
  return useQuery({
    queryKey: [...sellersKeys.detail(sellerId ?? 0), 'factoring-agreements'] as const,
    queryFn: () => sellersApi.listFactoringAgreements(sellerId as number),
    enabled: typeof sellerId === 'number' && sellerId > 0,
    staleTime: 60 * 1000, // 1 minute — agreements change infrequently
  })
}
