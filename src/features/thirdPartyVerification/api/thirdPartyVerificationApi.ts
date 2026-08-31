/**
 * Third-Party Verification Report API
 *
 * API calls to the client-service verification report endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { ThirdPartyVerificationParams, ThirdPartyVerificationResponse } from './types'

const VERIFICATION_REPORT_URL = '/api/v1/clients/reports/third-party-verification'

/**
 * Get the "Верифікація 3-х осіб" per-operator verification report.
 */
export async function getThirdPartyVerificationReport(
  params: ThirdPartyVerificationParams
): Promise<ThirdPartyVerificationResponse> {
  const response = await api.get<ThirdPartyVerificationResponse>(VERIFICATION_REPORT_URL, {
    params,
  })
  return response.data
}
