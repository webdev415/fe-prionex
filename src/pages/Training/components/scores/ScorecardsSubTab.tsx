/**
 * ScorecardsSubTab â€” cross-operator scorecard list (KAN-410, Feature 2.1).
 *
 * Read-side view: trainers see every completed scorecard in scope. Per-call
 * scorecard fill-in lives on the CallRecordingModal (step 6 follow-up wires
 * the side panel into the existing modal in the Calls top-tab flow).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOperators } from '@/features/users/hooks'
import { useScorecards, useExportScorecards } from '@/features/quality'
import type { Scorecard, ScorecardStatus } from '@/features/quality'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useScopedUserIds } from '../../lib/scope'

const STATUSES: ScorecardStatus[] = ['draft', 'completed', 'sent']
const DEFAULT_PAGE_SIZE = 25

export function ScorecardsSubTab() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ScorecardStatus | ''>('')

  const filters = useMemo(
    () => ({
      operator_id: scoped.userIds,
      status: statusFilter ? [statusFilter] : undefined,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [scoped.userIds, statusFilter, page]
  )

  const { data, isLoading, isError } = useScorecards(filters, !scoped.isEmptyResolution)
  const exportMutation = useExportScorecards()

  const operatorLookup = useMemo(() => {
    const map = new Map<number, string>()
    operators.forEach((op) => {
      map.set(op.id, op.full_name ?? `#${op.id}`)
    })
    return map
  }, [operators])

  const rows: Scorecard[] = data?.data ?? []
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
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            {t('pages.training.filters.status', 'Status')}
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ScorecardStatus | '')
              setPage(1)
            }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          >
            <option value="">{t('pages.training.filters.allStatuses', 'All statuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`pages.training.scorecard.status.${s}`, s)}
              </option>
            ))}
          </select>
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
            ? t('pages.training.actions.exporting', 'Exportingâ€¦')
            : t('pages.training.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              <th className="px-3 py-2">{t('pages.training.columns.date', 'Date')}</th>
              <th className="px-3 py-2">{t('pages.training.columns.operator', 'Operator')}</th>
              <th className="px-3 py-2">{t('pages.training.columns.template', 'Template')}</th>
              <th className="px-3 py-2">{t('pages.training.columns.status', 'Status')}</th>
              <th className="px-3 py-2 text-right">
                {t('pages.training.columns.weightedScore', 'Score')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {isLoading ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={5}>
                  {t('common.loading', 'Loadingâ€¦')}
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td className="px-3 py-6 text-center text-red-500" colSpan={5}>
                  {t('pages.training.errors.loadScorecardsFailed', 'Failed to load scorecards')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={5}>
                  {t('pages.training.scorecardsEmpty', 'No scorecards in scope.')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {operatorLookup.get(row.operator_id) ?? `#${row.operator_id}`}
                  </td>
                  <td className="px-3 py-2">{row.template_snapshot.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === 'sent'
                          ? 'bg-green-100 text-green-700'
                          : row.status === 'completed'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {t(`pages.training.scorecard.status.${row.status}`, row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {row.weighted_score != null ? row.weighted_score : 'â€”'}
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
            {t('common.page', 'Page')} {page} {t('common.of', 'of')} {totalPages} Â· {total}{' '}
            {t('pages.training.scorecardsTotalSuffix', 'scorecards')}
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
