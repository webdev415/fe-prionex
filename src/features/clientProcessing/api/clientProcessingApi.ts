/**
 * Client Processing Report API
 *
 * API calls to the client-service processing report endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { ProcessingReportParams, ProcessingReportResponse } from './types'

const PROCESSING_REPORT_URL = '/api/v1/clients/reports/processing'

/**
 * Get the "Відпрацювання за ЦД" per-employee processing report.
 */
export async function getClientProcessingReport(
  params: ProcessingReportParams
): Promise<ProcessingReportResponse> {
  const response = await api.get<ProcessingReportResponse>(PROCESSING_REPORT_URL, { params })
  return response.data
}
