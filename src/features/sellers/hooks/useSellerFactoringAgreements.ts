/**
 * useSellerFactoringAgreements Hook
 *
 * Fetches a paginated page of factoring agreements for a seller.
 * Agreements are seller-scoped global entities — the seller card and
 * the import wizard's "Pick existing" dropdown both consume this hook
 * with different option sets:
 *   - Seller card: default { skip, limit, include_count:true } so the
 *     "Number of debts" column has real values.
 *   - Wizard: { limit:1000, include_count:false } to skip the expensive
 *     per-row COUNT subquery (dropdown never displays the count, and
 *     for high-debt sellers like Егроши Ком the count costs 2+ seconds).
 */

import { useQuery } from '@tanstack/react-query'
import { sellersApi } from '../api/sellersApi'
import { sellersKeys } from './useSellers'

interface UseSellerFactoringAgreementsOptions {
  skip?: number
  limit?: number
  include_count?: boolean
}

export function useSellerFactoringAgreements(
  sellerId: number | undefined | null,
  options: UseSellerFactoringAgreementsOptions = {}
) {
  return useQuery({
    queryKey: [...sellersKeys.detail(sellerId ?? 0), 'factoring-agreements', options] as const,
    queryFn: () => sellersApi.listFactoringAgreements(sellerId as number, options),
    enabled: typeof sellerId === 'number' && sellerId > 0,
    staleTime: 60 * 1000,
  })
}
