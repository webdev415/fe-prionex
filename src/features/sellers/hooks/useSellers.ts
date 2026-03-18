/**
 * useSellers Hook
 *
 * React Query hooks for fetching sellers.
 */

import { useQuery } from '@tanstack/react-query'
import { sellersApi } from '../api/sellersApi'
import type { SellerListParams } from '../types'

/**
 * Query key factory for sellers
 */
export const sellersKeys = {
  all: ['sellers'] as const,
  lists: () => [...sellersKeys.all, 'list'] as const,
  list: (params: SellerListParams) => [...sellersKeys.lists(), params] as const,
  details: () => [...sellersKeys.all, 'detail'] as const,
  detail: (id: number, includeStatistics: boolean = false) =>
    [...sellersKeys.details(), id, includeStatistics] as const,
}

/**
 * Hook to fetch sellers list
 *
 * @param params - Query parameters for filtering and pagination
 * @returns React Query result with sellers data
 */
export function useSellers(params: SellerListParams = {}) {
  return useQuery({
    queryKey: sellersKeys.list(params),
    queryFn: () => sellersApi.getSellers(params),
    staleTime: 5 * 60 * 1000, // 5 minutes - sellers change infrequently
  })
}

/**
 * Hook to fetch a single seller detail
 *
 * @param sellerId - The seller ID to fetch
 * @param includeStatistics - Whether to include debt statistics
 * @returns React Query result with seller detail data
 */
export function useSellerDetail(sellerId: number | null, includeStatistics: boolean = false) {
  return useQuery({
    queryKey: sellersKeys.detail(sellerId ?? 0, includeStatistics),
    queryFn: () => sellersApi.getSeller(sellerId!, includeStatistics),
    enabled: sellerId !== null && sellerId > 0,
  })
}
