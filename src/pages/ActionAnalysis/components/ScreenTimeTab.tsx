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
  if (highlight === 'red') return 'bg-error-100'
  if (highlight === 'green') return 'bg-success-100'
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
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
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
          leftIcon={<Icons.Download size={16} className="text-primary-foreground" />}
          className="h-[45px] rounded-full sm:px-6"
        >
          {exportMutation.isPending
            ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
            : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      {!periodReady ? (
        <div className="bg-card/50 text-muted-foreground rounded-xl p-6 text-center text-sm shadow-sm">
          {t(
            'pages.actionAnalysis.filters.selectCustomRange',
            'Pick a custom date range to load data.'
          )}
        </div>
      ) : isError ? (
        <div className="bg-error-100 text-error-700 rounded-xl p-6 text-center text-sm shadow-sm">
          {t(
            'pages.actionAnalysis.errors.loadScreenTimeFailed',
            'Failed to load screen-time data.'
          )}
        </div>
      ) : isPending ? (
        <div className="bg-card/80 overflow-x-auto rounded-xl shadow-sm">
          <TableSkeleton columns={6} rows={8} className="w-full" />
        </div>
      ) : !data?.operators?.length ? (
        <div className="bg-card/50 text-muted-foreground rounded-xl p-6 text-center text-sm shadow-sm">
          {t(
            'pages.actionAnalysis.screenTime.empty',
            'No screen-time data for the selected filters.'
          )}
        </div>
      ) : (
        <div className="bg-card/80 overflow-x-auto rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.screenTime.columns.operator', 'Operator')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.screenTime.columns.cardOpen', 'Avg call→card')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.screenTime.columns.formSubmit', 'Avg form submit')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.screenTime.columns.idle', 'Idle total')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.screenTime.columns.afterCall', 'After-call')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.screenTime.columns.deviation', 'Δ vs team')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map((op) => (
                <tr
                  key={op.operator_id}
                  className={`border-border border-t ${highlightStyles(op.highlight)}`}
                >
                  <td className="text-foreground px-4 py-2 font-medium">
                    {operatorById.get(op.operator_id) ?? `#${op.operator_id}`}
                  </td>
                  <td className="text-foreground px-4 py-2">{formatMs(op.time_to_card_open_ms)}</td>
                  <td className="text-foreground px-4 py-2">
                    {formatMs(op.time_to_form_submit_ms)}
                  </td>
                  <td className="text-foreground px-4 py-2">{formatMs(op.idle_total_ms)}</td>
                  <td className="text-foreground px-4 py-2">
                    {formatMs(op.after_call_processing_ms)}
                  </td>
                  <td className="text-foreground px-4 py-2 font-mono text-xs">
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
