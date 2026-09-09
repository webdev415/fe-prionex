/**
 * Promises Feed API
 *
 * API call to the client-service promises feed endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { PromisesFeedParams, PromisesFeedResponse } from './types'

const PROMISES_FEED_URL = '/api/v1/clients/reports/feeds/promises'

/**
 * Get the «Обіцянки» promises feed (one row per promise whose promised date
 * falls inside the window, with the worked/paid enrichments).
 */
export async function getPromisesFeed(params: PromisesFeedParams): Promise<PromisesFeedResponse> {
  const response = await api.get<PromisesFeedResponse>(PROMISES_FEED_URL, {
    params,
  })
  return response.data
}
