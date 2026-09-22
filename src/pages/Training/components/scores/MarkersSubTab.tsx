/**
 * MarkersSubTab — cross-call marker browser (KAN-410, Feature 2.2).
 *
 * Trainers filter every marker in scope by type / status and export to xlsx.
 * The per-call marker creation flow lives on the call recording modal
 * (AddMarkerButton); this view is read-only review.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { formatDateTime } from '@/lib/localeFormat'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useExportMarkers, useMarkers } from '@/features/quality/hooks/useMarkers'
import {
  MARKER_COLORS,
  MARKER_TYPES,
  type CallMarker,
  type MarkerStatus,
  type MarkerType,
} from '@/features/quality'
import { useScopedUserIds } from '../../lib/scope'
import { piiProps } from '@/lib/openreplay/pii'

const STATUSES: MarkerStatus[] = ['draft', 'sent']
const DEFAULT_PAGE_SIZE = 25

export function MarkersSubTab() {
  const { t, i18n } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<MarkerStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<MarkerType | ''>('')

  const filters = useMemo(
    () => ({
      operator_id: scoped.userIds,
      marker_type: typeFilter ? [typeFilter] : undefined,
      status: statusFilter ? [statusFilter] : undefined,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [scoped.userIds, statusFilter, typeFilter, page]
  )

  const { data, isLoading, isError } = useMarkers(filters, !scoped.isEmptyResolution)
  const exportMutation = useExportMarkers()

  const operatorLookup = useMemo(() => {
    const map = new Map<number, string>()
    operators.forEach((op) => {
      map.set(op.id, op.full_name ?? `#${op.id}`)
    })
    return map
  }, [operators])

  const rows: CallMarker[] = data?.data ?? []
  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.total_pages ?? 0

  if (scoped.isEmptyResolution) {
    return (
      <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
        {t(
          'pages.training.errors.emptyScopeResolution',
          'The selected scope returned no operators.'
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">
              {t('pages.training.filters.markerType', 'Type')}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as MarkerType | '')
                setPage(1)
              }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            >
              <option value="">{t('pages.training.filters.allMarkerTypes', 'All types')}</option>
              {MARKER_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {t(`pages.training.markers.types.${mt}`, mt.replace(/_/g, ' '))}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">
              {t('pages.training.filters.status', 'Status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as MarkerStatus | '')
                setPage(1)
              }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            >
              <option value="">{t('pages.training.filters.allStatuses', 'All statuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`pages.training.markers.status.${s}`, s)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => exportMutation.mutate(filters)}
          disabled={exportMutation.isPending || total === 0}
          leftIcon={<Icons.Download size={16} className="text-white" />}
          className="h-[40px] rounded-full text-xs"
        >
          {exportMutation.isPending
            ? t('pages.training.actions.exporting', 'Exporting…')
            : t('pages.training.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              <th className="px-3 py-2">{t('pages.training.columns.date', 'Date')}</th>
              <th className="px-3 py-2">{t('pages.training.columns.operator', 'Operator')}</th>
              <th className="px-3 py-2">{t('pages.training.columns.markerType', 'Type')}</th>
              <th className="px-3 py-2">{t('pages.training.columns.timestamp', 'Timestamp')}</th>
              <th className="px-3 py-2">{t('pages.training.columns.comment', 'Comment')}</th>
              <th className="px-3 py-2">{t('pages.training.columns.status', 'Status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {isLoading ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={6}>
                  {t('common.loading', 'Loading…')}
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td className="px-3 py-6 text-center text-red-500" colSpan={6}>
                  {t('pages.training.errors.loadMarkersFailed', 'Failed to load markers')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={6}>
                  {t('pages.training.markersEmpty', 'No markers in scope.')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{formatDateTime(row.created_at, i18n.language)}</td>
                  <td className="px-3 py-2">
                    {operatorLookup.get(row.operator_id) ?? `#${row.operator_id}`}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-2"
                      style={{ color: MARKER_COLORS[row.marker_type] }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: MARKER_COLORS[row.marker_type] }}
                      />
                      {t(
                        `pages.training.markers.types.${row.marker_type}`,
                        row.marker_type.replace(/_/g, ' ')
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {formatTimestamp(row.timestamp_ms)}
                  </td>
                  {/* Free text an operator typed about the call. */}
                  <td className="max-w-[24rem] truncate px-3 py-2 text-gray-600" {...piiProps}>
                    {row.comment ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === 'sent'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {t(`pages.training.markers.status.${row.status}`, row.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {t('common.page', 'Page')} {page} {t('common.of', 'of')} {totalPages} · {total}{' '}
            {t('pages.training.markersTotalSuffix', 'markers')}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-full"
            >
              {t('common.previous', 'Previous')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-full"
            >
              {t('common.next', 'Next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}
