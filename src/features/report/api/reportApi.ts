/**
 * Report Service API
 *
 * API calls to the Report Service backend.
 * Uses main api client (goes through Kong on port 8000)
 */

import api from '@/lib/api'
import type {
  BackendDashboardResponse,
  BackendOperatorPerformanceResponse,
  BackendClientStatisticsResponse,
  BackendCommunicationStatisticsResponse,
  DashboardParams,
  OperatorPerformanceParams,
  ClientStatisticsParams,
  CommunicationStatisticsParams,
  ExportParams,
} from './types'

const REPORTS_BASE_URL = '/api/v1/reports'
const EXPORT_BASE_URL = '/api/v1/export'

// ============================================================================
// Dashboard
// ============================================================================

/**
 * Get dashboard with KPIs and top operators
 */
export async function getDashboard(params: DashboardParams): Promise<BackendDashboardResponse> {
  const response = await api.get<BackendDashboardResponse>(`${REPORTS_BASE_URL}/dashboard`, {
    params,
  })
  return response.data
}

// ============================================================================
// Operator Performance
// ============================================================================

/**
 * Get operator performance report
 */
export async function getOperatorPerformance(
  params: OperatorPerformanceParams
): Promise<BackendOperatorPerformanceResponse> {
  const response = await api.get<BackendOperatorPerformanceResponse>(
    `${REPORTS_BASE_URL}/operator-performance`,
    { params }
  )
  return response.data
}

// ============================================================================
// Client Statistics
// ============================================================================

/**
 * Get client statistics grouped by field
 */
export async function getClientStatistics(
  params: ClientStatisticsParams
): Promise<BackendClientStatisticsResponse> {
  const response = await api.get<BackendClientStatisticsResponse>(
    `${REPORTS_BASE_URL}/client-statistics`,
    { params }
  )
  return response.data
}

// ============================================================================
// Communication Statistics
// ============================================================================

/**
 * Get communication statistics (calls and SMS)
 */
export async function getCommunicationStatistics(
  params: CommunicationStatisticsParams
): Promise<BackendCommunicationStatisticsResponse> {
  const response = await api.get<BackendCommunicationStatisticsResponse>(
    `${REPORTS_BASE_URL}/communication-statistics`,
    { params }
  )
  return response.data
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export dashboard to CSV or PDF
 */
export async function exportDashboard(params: ExportParams): Promise<Blob> {
  const response = await api.get(`${EXPORT_BASE_URL}/dashboard`, {
    params,
    responseType: 'blob',
  })
  return response.data
}

/**
 * Export operator performance to CSV or PDF
 */
export async function exportOperatorPerformance(params: ExportParams): Promise<Blob> {
  const response = await api.get(`${EXPORT_BASE_URL}/operator-performance`, {
    params,
    responseType: 'blob',
  })
  return response.data
}

/**
 * Export client statistics to CSV
 */
export async function exportClientStatistics(params: ExportParams): Promise<Blob> {
  const response = await api.get(`${EXPORT_BASE_URL}/client-statistics`, {
    params,
    responseType: 'blob',
  })
  return response.data
}

/**
 * Export communication statistics to CSV or PDF
 */
export async function exportCommunicationStatistics(params: ExportParams): Promise<Blob> {
  const response = await api.get(`${EXPORT_BASE_URL}/communication-statistics`, {
    params,
    responseType: 'blob',
  })
  return response.data
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check report service health
 */
export async function checkHealth(): Promise<{ status: string; service: string }> {
  const response = await api.get<{ status: string; service: string }>(`${REPORTS_BASE_URL}/health`)
  return response.data
}

// ============================================================================
// Exported API Object
// ============================================================================

/**
 * Report API object for easier importing
 */
export const reportApi = {
  // Reports
  getDashboard,
  getOperatorPerformance,
  getClientStatistics,
  getCommunicationStatistics,

  // Exports
  exportDashboard,
  exportOperatorPerformance,
  exportClientStatistics,
  exportCommunicationStatistics,

  // Health
  checkHealth,
}
