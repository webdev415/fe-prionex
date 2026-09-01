/**
 * Outbound Calls Report API
 *
 * API call to the client-service outbound-calls report endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { OutboundCallsReportParams, OutboundCallsReportResponse } from './types'

const OUTBOUND_CALLS_REPORT_URL = '/api/v1/clients/reports/outbound-calls'

/**
 * Get the «Вихідні дзвінки» report (one row per operator seat: calls dialled,
 * connected and quality counts, the talk time behind them and the seat's org
 * placement).
 */
export async function getOutboundCallsReport(
  params: OutboundCallsReportParams
): Promise<OutboundCallsReportResponse> {
  const response = await api.get<OutboundCallsReportResponse>(OUTBOUND_CALLS_REPORT_URL, {
    params,
  })
  return response.data
}
