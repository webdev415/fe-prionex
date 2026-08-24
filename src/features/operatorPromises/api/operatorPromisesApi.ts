/**
 * Operator Promises Report API
 *
 * API call to the client-service operator-promises report endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { OperatorPromisesReportParams, OperatorPromisesReportResponse } from './types'

const OPERATOR_PROMISES_REPORT_URL = '/api/v1/clients/reports/operator-promises'

/**
 * Get the «Обіцянки по операторах» report (one row per operator: chain runs
 * touched, money promised, money due, money collected and the conversion
 * between the last two).
 */
export async function getOperatorPromisesReport(
  params: OperatorPromisesReportParams
): Promise<OperatorPromisesReportResponse> {
  const response = await api.get<OperatorPromisesReportResponse>(OPERATOR_PROMISES_REPORT_URL, {
    params,
  })
  return response.data
}
