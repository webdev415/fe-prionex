/**
 * Export Hooks
 *
 * React Query mutations for exporting reports to CSV and PDF.
 */

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import type { AxiosError } from 'axios'
import { reportApi } from '../api/reportApi'
import type { ExportFormat, ExportParams } from '../api/types'
import { mapPeriodToBackend } from '../utils/transformers'
import type { Period } from '../types'

/**
 * Helper to trigger file download from blob
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Get file extension from format
 */
function getExtension(format: ExportFormat): string {
  return format === 'pdf' ? 'pdf' : 'csv'
}

// ============================================================================
// Export Dashboard
// ============================================================================

export interface ExportDashboardParams {
  projectId: number
  format: ExportFormat
  period?: Period
  /**
   * Window start, YYYY-MM-DD — the same date the screen shows, computed in the
   * user's profile time zone. Without it the backend re-derives "today" on its
   * own clock and the file can disagree with the screen (board #1338).
   */
  startDate?: string
  /** Window end, YYYY-MM-DD, same rules as `startDate`. */
  endDate?: string
  /** IANA time zone of the window (the profile `timezone`); omitted when unknown. */
  timezone?: string | null
}

/**
 * Query params for GET /api/v1/export/dashboard (contract C4): period plus the
 * explicit window and its time zone. Empty values are left out rather than
 * sent as blanks, so the backend keeps its defaults for them.
 */
export function buildDashboardExportParams({
  projectId,
  format,
  period = 'today',
  startDate,
  endDate,
  timezone,
}: ExportDashboardParams): ExportParams {
  const params: ExportParams = {
    project_id: projectId,
    format,
    period: mapPeriodToBackend(period),
  }
  if (startDate) params.start_date = startDate
  if (endDate) params.end_date = endDate
  if (timezone) params.timezone = timezone
  return params
}

/**
 * Download file name for the dashboard export, dated by the exported window —
 * the same profile-time-zone dates the request carries — not by the UTC clock:
 * at 00:30 Kyiv on 22.09 a «today» export holds 22.09 and must say so.
 * One day → `dashboard_<period>_<date>`; a range → `…_<start>_<end>`. Without
 * a window it falls back to today's UTC date (the old name).
 */
export function buildDashboardExportFilename({
  format,
  period = 'today',
  startDate,
  endDate,
}: Pick<ExportDashboardParams, 'format' | 'period' | 'startDate' | 'endDate'>): string {
  let dated: string
  if (startDate && endDate) {
    dated = startDate === endDate ? startDate : `${startDate}_${endDate}`
  } else {
    dated = endDate || startDate || new Date().toISOString().split('T')[0]
  }
  return `dashboard_${period}_${dated}.${getExtension(format)}`
}

/**
 * Hook for exporting dashboard to CSV or PDF
 *
 * @example
 * ```tsx
 * const { mutate: exportDashboard, isPending } = useExportDashboard()
 *
 * <Button
 *   onClick={() =>
 *     exportDashboard({
 *       projectId: 1,
 *       format: 'csv',
 *       period: 'today',
 *       startDate: '2026-09-21',
 *       endDate: '2026-09-21',
 *       timezone: 'Europe/Kyiv',
 *     })
 *   }
 *   disabled={isPending}
 * >
 *   {isPending ? 'Exporting...' : 'Export CSV'}
 * </Button>
 * ```
 */
export function useExportDashboard() {
  return useMutation({
    mutationFn: async (exportParams: ExportDashboardParams) => {
      const params = buildDashboardExportParams(exportParams)

      const blob = await reportApi.exportDashboard(params)
      const filename = buildDashboardExportFilename(exportParams)
      downloadBlob(blob, filename)

      return { filename }
    },
    onSuccess: ({ filename }) => {
      toast.success(`Downloaded ${filename}`)
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.reports.dashboardExportFailed', {
          defaultValue: 'Failed to export dashboard',
        })
      toast.error(message)
    },
  })
}

// ============================================================================
// Export Operator Performance
// ============================================================================

export interface ExportOperatorPerformanceParams {
  projectId: number
  format: ExportFormat
  operatorId?: number
  fromDate?: string
  toDate?: string
}

/**
 * Hook for exporting operator performance to CSV or PDF
 */
export function useExportOperatorPerformance() {
  return useMutation({
    mutationFn: async ({
      projectId,
      format,
      operatorId,
      fromDate,
      toDate,
    }: ExportOperatorPerformanceParams) => {
      const params: ExportParams = {
        project_id: projectId,
        format,
        operator_id: operatorId,
        from_date: fromDate,
        to_date: toDate,
      }

      const blob = await reportApi.exportOperatorPerformance(params)
      const suffix = operatorId ? `operator_${operatorId}` : 'all_operators'
      const filename = `operator_performance_${suffix}_${new Date().toISOString().split('T')[0]}.${getExtension(format)}`
      downloadBlob(blob, filename)

      return { filename }
    },
    onSuccess: ({ filename }) => {
      toast.success(`Downloaded ${filename}`)
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.reports.operatorPerformanceExportFailed', {
          defaultValue: 'Failed to export operator performance',
        })
      toast.error(message)
    },
  })
}

// ============================================================================
// Export Client Statistics
// ============================================================================

export interface ExportClientStatisticsParams {
  projectId: number
  groupBy?: 'status' | 'priority' | 'city' | 'debt_range'
}

/**
 * Hook for exporting client statistics to CSV
 * Note: PDF not supported for client statistics
 */
export function useExportClientStatistics() {
  return useMutation({
    mutationFn: async ({ projectId, groupBy = 'status' }: ExportClientStatisticsParams) => {
      const params: ExportParams = {
        project_id: projectId,
        format: 'csv', // Only CSV supported
        group_by: groupBy,
      }

      const blob = await reportApi.exportClientStatistics(params)
      const filename = `client_statistics_by_${groupBy}_${new Date().toISOString().split('T')[0]}.csv`
      downloadBlob(blob, filename)

      return { filename }
    },
    onSuccess: ({ filename }) => {
      toast.success(`Downloaded ${filename}`)
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.reports.clientStatisticsExportFailed', {
          defaultValue: 'Failed to export client statistics',
        })
      toast.error(message)
    },
  })
}

// ============================================================================
// Export Communication Statistics
// ============================================================================

export interface ExportCommunicationStatisticsParams {
  projectId: number
  format: ExportFormat
  fromDate?: string
  toDate?: string
}

/**
 * Hook for exporting communication statistics to CSV or PDF
 */
export function useExportCommunicationStatistics() {
  return useMutation({
    mutationFn: async ({
      projectId,
      format,
      fromDate,
      toDate,
    }: ExportCommunicationStatisticsParams) => {
      const params: ExportParams = {
        project_id: projectId,
        format,
        from_date: fromDate,
        to_date: toDate,
      }

      const blob = await reportApi.exportCommunicationStatistics(params)
      const filename = `communication_statistics_${new Date().toISOString().split('T')[0]}.${getExtension(format)}`
      downloadBlob(blob, filename)

      return { filename }
    },
    onSuccess: ({ filename }) => {
      toast.success(`Downloaded ${filename}`)
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.reports.communicationStatisticsExportFailed', {
          defaultValue: 'Failed to export communication statistics',
        })
      toast.error(message)
    },
  })
}
