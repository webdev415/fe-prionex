/**
 * Drains Feed API
 *
 * API call to the client-service drains feed endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { DrainsFeedParams, DrainsFeedResponse } from './types'

const DRAINS_FEED_URL = '/api/v1/clients/reports/feeds/drains'

/**
 * Get the «Зливи» broken-promise list (one row per CLIENT, resolved from their
 * last promise, kept only while the promised amount still exceeds what they
 * paid).
 */
export async function getDrainsFeed(params: DrainsFeedParams): Promise<DrainsFeedResponse> {
  const response = await api.get<DrainsFeedResponse>(DRAINS_FEED_URL, {
    params,
  })
  return response.data
}
