/**
 * Searcher Follow-up Feed API
 *
 * API calls to the client-service searcher follow-up feed endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { SearcherFollowupFeedParams, SearcherFollowupResponse } from './types'

const SEARCHER_FOLLOWUP_FEED_URL = '/api/v1/clients/reports/feeds/searcher-followup'

/**
 * Get the «Відпрацювання серчера» client work list (one row per client whose
 * latest interaction is a successful searcher find nobody has acted on).
 */
export async function getSearcherFollowupFeed(
  params: SearcherFollowupFeedParams
): Promise<SearcherFollowupResponse> {
  const response = await api.get<SearcherFollowupResponse>(SEARCHER_FOLLOWUP_FEED_URL, {
    params,
  })
  return response.data
}
