import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useExportScriptAnalytics, useScriptAnalytics } from '@/features/operatorAnalytics'
import {
  readAnalyticsBarState,
  toAnalyticsRangeFilters,
  writeAnalyticsBarState,
  type AnalyticsBarState,
} from '../lib/analyticsUrlState'
import { AnalyticsFiltersBar } from './AnalyticsFiltersBar'

export function ScriptAnalyticsTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const urlState = readAnalyticsBarState(searchParams)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const filters = toAnalyticsRangeFilters(urlState)
  const periodReady =
    urlState.period !== 'custom' || !!(urlState.customFromDate && urlState.customToDate)

  const { data, isLoading, isError } = useScriptAnalytics(filters, periodReady)
  const exportMutation = useExportScriptAnalytics()

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
      console.error('Script-analytics export failed', err)
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
    }
  }

  const opsData = data?.operators ?? []
  const teamMax = useMemo(() => {
    const counts = Object.values(data?.team_distribution ?? {})
    if (!counts.length) return 0
    return Math.max(...counts)
  }, [data])

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
          disabled={!periodReady || exportMutation.isPending || !opsData.length}
          leftIcon={<Icons.Download size={16} className="text-dark-500" />}
          className="h-[45px] rounded-full sm:px-6"
        >
          {exportMutation.isPending
            ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
            : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      {!periodReady ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t(
            'pages.actionAnalysis.filters.selectCustomRange',
            'Pick a custom date range to load data.'
          )}
        </div>
      ) : isError ? (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">
          {t(
            'pages.actionAnalysis.errors.loadScriptAnalyticsFailed',
            'Failed to load script analytics.'
          )}
        </div>
      ) : isLoading ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t('common.loading', 'Loading...')}
        </div>
      ) : !opsData.length ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t(
            'pages.actionAnalysis.scriptAnalytics.empty',
            'No script-analytics data for the selected filters.'
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-white/80 p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              {t('pages.actionAnalysis.scriptAnalytics.teamDistribution', 'Team distribution')}
            </h3>
            <div className="flex flex-col gap-1.5">
              {Object.entries(data?.team_distribution ?? {}).map(([result, count]) => (
                <div key={result} className="flex items-center gap-3 text-xs">
                  <span className="w-40 shrink-0 truncate text-gray-700">{result}</span>
                  <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="bg-primary-400"
                      style={{ width: teamMax ? `${Math.round((count / teamMax) * 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-gray-500">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl bg-white/80 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-4 py-2">
                    {t('pages.actionAnalysis.scriptAnalytics.columns.operator', 'Operator')}
                  </th>
                  <th className="px-4 py-2">
                    {t(
                      'pages.actionAnalysis.scriptAnalytics.columns.totalInteractions',
                      'Interactions'
                    )}
                  </th>
                  <th className="px-4 py-2">
                    {t('pages.actionAnalysis.scriptAnalytics.columns.fastResultPct', 'Fast %')}
                  </th>
                  <th className="px-4 py-2">
                    {t('pages.actionAnalysis.scriptAnalytics.columns.distribution', 'Distribution')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {opsData.map((op) => (
                  <tr key={op.operator_id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {operatorById.get(op.operator_id) ?? `#${op.operator_id}`}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-700">{op.total_interactions}</td>
                    <td className="px-4 py-2 font-mono text-gray-700">{op.fast_result_pct}%</td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      {Object.entries(op.distribution).map(([result, count]) => (
                        <span
                          key={result}
                          className="mr-2 inline-block rounded-full bg-gray-100 px-2 py-0.5"
                        >
                          {result}: <span className="font-mono">{count}</span>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data?.flags?.length ? (
            <div className="rounded-xl bg-yellow-50 p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-medium text-yellow-800">
                {t('pages.actionAnalysis.scriptAnalytics.flagsHeading', 'Auto-flags')}
              </h3>
              <ul className="flex flex-col gap-1.5 text-xs text-yellow-900">
                {data.flags.map((flag, idx) => (
                  <li
                    key={`${flag.operator_id}-${flag.rule}-${idx}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="font-medium">
                      {operatorById.get(flag.operator_id) ?? `#${flag.operator_id}`}
                    </span>
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 font-mono">
                      {flag.rule}
                    </span>
                    <span className="font-mono">
                      {flag.value} / {flag.threshold}
                    </span>
                    {flag.detail ? <span className="text-yellow-800">{flag.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
