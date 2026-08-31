/**
 * Inbound Follow-up Feed API
 *
 * API calls to the client-service inbound follow-up feed endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { InboundFollowupFeedParams, InboundFollowupResponse } from './types'

const INBOUND_FOLLOWUP_FEED_URL = '/api/v1/clients/reports/feeds/inbound-followup'

/**
 * Get the «Вхід без відпрацювання» client work list (one row per client whose
 * latest interaction is a support step parked on «Очікує на зворотній зв'язок»
 * that nobody has followed up).
 */
export async function getInboundFollowupFeed(
  params: InboundFollowupFeedParams
): Promise<InboundFollowupResponse> {
  const response = await api.get<InboundFollowupResponse>(INBOUND_FOLLOWUP_FEED_URL, {
    params,
  })
  return response.data
}
