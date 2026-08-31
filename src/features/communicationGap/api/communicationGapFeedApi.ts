/**
 * Communication-Gap Feed API
 *
 * API calls to the client-service communication-gap feed endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { CommunicationGapFeedParams, CommunicationGapFeedResponse } from './types'

const COMMUNICATION_GAP_FEED_URL = '/api/v1/clients/reports/feeds/communication-gap'

/**
 * Get the «Великий розрив» client work list (one row per client with a live
 * debt that nobody has contacted in a while and who has not paid recently).
 */
export async function getCommunicationGapFeed(
  params: CommunicationGapFeedParams
): Promise<CommunicationGapFeedResponse> {
  const response = await api.get<CommunicationGapFeedResponse>(COMMUNICATION_GAP_FEED_URL, {
    params,
  })
  return response.data
}
