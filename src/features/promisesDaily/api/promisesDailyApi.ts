/**
 * Promises Daily Report API
 *
 * API call to the client-service promises-daily report endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { PromisesDailyReportParams, PromisesDailyReportResponse } from './types'

const PROMISES_DAILY_REPORT_URL = '/api/v1/clients/reports/promises-daily'

/**
 * Get the «Обіцянки до кінця місяця» report (a day × department matrix: how
 * much money was promised for each day of the window, per department, with
 * per-department and grand totals).
 */
export async function getPromisesDailyReport(
  params: PromisesDailyReportParams
): Promise<PromisesDailyReportResponse> {
  const response = await api.get<PromisesDailyReportResponse>(PROMISES_DAILY_REPORT_URL, {
    params,
  })
  return response.data
}
