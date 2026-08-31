/**
 * Low-Verification Feed API
 *
 * API calls to the client-service low-verification feed endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { LowVerificationFeedParams, LowVerificationFeedResponse } from './types'

const LOW_VERIFICATION_FEED_URL = '/api/v1/clients/reports/feeds/low-verification'

/**
 * Get the «Мало верифікацій 3-х осіб» client work list (one row per client).
 */
export async function getLowVerificationFeed(
  params: LowVerificationFeedParams
): Promise<LowVerificationFeedResponse> {
  const response = await api.get<LowVerificationFeedResponse>(LOW_VERIFICATION_FEED_URL, {
    params,
  })
  return response.data
}
