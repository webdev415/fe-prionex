/**
 * Sellers API
 *
 * API functions for seller CRUD operations.
 */

import api from '@/lib/api'
import type {
  SellerListResponse,
  SellerListParams,
  SellerDetailResponse,
  CreateSellerInput,
  UpdateSellerInput,
} from '../types'

/**
 * Fetch paginated list of sellers
 */
export async function getSellers(params: SellerListParams = {}): Promise<SellerListResponse> {
  const response = await api.get<SellerListResponse>('/api/v1/sellers', { params })
  return response.data
}

/**
 * Fetch a single seller by ID
 */
export async function getSeller(
  sellerId: number,
  includeStatistics: boolean = false
): Promise<SellerDetailResponse> {
  const response = await api.get<SellerDetailResponse>(`/api/v1/sellers/${sellerId}`, {
    params: { include_statistics: includeStatistics },
  })
  return response.data
}

/**
 * Create a new seller
 */
export async function createSeller(data: CreateSellerInput): Promise<SellerDetailResponse> {
  const response = await api.post<SellerDetailResponse>('/api/v1/sellers', data)
  return response.data
}

/**
 * Update an existing seller
 */
export async function updateSeller(
  sellerId: number,
  data: UpdateSellerInput
): Promise<SellerDetailResponse> {
  const response = await api.put<SellerDetailResponse>(`/api/v1/sellers/${sellerId}`, data)
  return response.data
}

/**
 * Delete a seller (soft delete)
 */
export async function deleteSeller(
  sellerId: number
): Promise<{ message: string; seller_id: number }> {
  const response = await api.delete<{ message: string; seller_id: number }>(
    `/api/v1/sellers/${sellerId}`
  )
  return response.data
}

export const sellersApi = {
  getSellers,
  getSeller,
  createSeller,
  updateSeller,
  deleteSeller,
}
