import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useExportScreenTime, useScreenTime } from '@/features/operatorAnalytics'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import {
  readAnalyticsBarState,
  toAnalyticsRangeFilters,
  writeAnalyticsBarState,
  type AnalyticsBarState,
} from '../lib/analyticsUrlState'
import { AnalyticsFiltersBar } from './AnalyticsFiltersBar'

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}m ${String(secs).padStart(2, '0')}s`
}

function highlightStyles(highlight: string | null | undefined): string {
  if (highlight === 'red') return 'bg-red-50'
  if (highlight === 'green') return 'bg-green-50'
  return ''
}

export function ScreenTimeTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const urlState = readAnalyticsBarState(searchParams)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const filters = toAnalyticsRangeFilters(urlState)
  const periodReady =
    urlState.period !== 'custom' || !!(urlState.customFromDate && urlState.customToDate)

  const { data, isPending, isError } = useScreenTime(filters, periodReady)
  const exportMutation = useExportScreenTime()

  const operatorById = useMemo(() => {
    const m = new Map<number, string>()
    operators.forEach((o) => {
      const name = [o.first_name, o.last_name].filter(Boolean).join(' ') || o.username
      m.set(o.id, name)
    })
    return m
  }, [operators])

  const apply = (next: AnalyticsBarState) => {
    setSearchParams(writeAnalyticsBarState(searchParams, next), { replace: true })
  }

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync(filters)
    } catch (err) {
      console.error('Screen-time export failed', err)
      toast.error(t('pages.training.errors.exportFailed', 'Export failed'))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <AnalyticsFiltersBar
        value={urlState}
        operators={operators}
        onApply={apply}
        onClear={() => setSearchParams(new URLSearchParams(), { replace: true })}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleExport}
          disabled={!periodReady || exportMutation.isPending || !data?.operators?.length}
          leftIcon={<Icons.Download size={16} className="text-dark-500" />}
          className="h-[45px] rounded-full sm:px-6"
        >
          {exportMutation.isPending
            ? t('pages.training.actions.exporting', 'Exporting…')
            : t('pages.training.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      {!periodReady ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t('pages.training.filters.selectCustomRange', 'Pick a custom date range to load data.')}
        </div>
      ) : isError ? (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">
          {t('pages.training.errors.loadScreenTimeFailed', 'Failed to load screen-time data.')}
        </div>
      ) : isPending ? (
        <div className="overflow-x-auto rounded-xl bg-white/80 shadow-sm">
          <TableSkeleton columns={6} rows={8} className="w-full" />
        </div>
      ) : !data?.operators?.length ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t('pages.training.screenTime.empty', 'No screen-time data for the selected filters.')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white/80 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-xs text-gray-600 uppercase">
              <tr>
                <th className="px-4 py-2">
                  {t('pages.training.screenTime.columns.operator', 'Operator')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.training.screenTime.columns.cardOpen', 'Avg call→card')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.training.screenTime.columns.formSubmit', 'Avg form submit')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.training.screenTime.columns.idle', 'Idle total')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.training.screenTime.columns.afterCall', 'After-call')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.training.screenTime.columns.deviation', 'Δ vs team')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map((op) => (
                <tr
                  key={op.operator_id}
                  className={`border-t border-gray-100 ${highlightStyles(op.highlight)}`}
                >
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {operatorById.get(op.operator_id) ?? `#${op.operator_id}`}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{formatMs(op.time_to_card_open_ms)}</td>
                  <td className="px-4 py-2 text-gray-700">{formatMs(op.time_to_form_submit_ms)}</td>
                  <td className="px-4 py-2 text-gray-700">{formatMs(op.idle_total_ms)}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {formatMs(op.after_call_processing_ms)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">
                    {op.deviation_pct == null
                      ? '—'
                      : `${op.deviation_pct > 0 ? '+' : ''}${op.deviation_pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
