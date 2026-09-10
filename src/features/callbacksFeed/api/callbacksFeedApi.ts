/**
 * Callbacks Feed API
 *
 * API call to the client-service callbacks feed endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { CallbacksFeedParams, CallbacksFeedResponse } from './types'

const CALLBACKS_FEED_URL = '/api/v1/clients/reports/feeds/callbacks'

/**
 * Get the «Перезвони» call plan (one row per interaction whose SCHEDULED
 * callback time falls inside the window, with the org and last-interaction
 * enrichments).
 */
export async function getCallbacksFeed(
  params: CallbacksFeedParams
): Promise<CallbacksFeedResponse> {
  const response = await api.get<CallbacksFeedResponse>(CALLBACKS_FEED_URL, {
    params,
  })
  return response.data
}
