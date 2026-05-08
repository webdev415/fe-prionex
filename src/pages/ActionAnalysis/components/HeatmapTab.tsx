import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useExportHeatmap, useHeatmap, type HeatmapState } from '@/features/operatorAnalytics'
import {
  readHeatmapBarState,
  toHeatmapFilters,
  writeHeatmapBarState,
  type HeatmapBarState,
} from '../lib/analyticsUrlState'
import { AnalyticsFiltersBar } from './AnalyticsFiltersBar'

const STATE_COLORS: Record<HeatmapState, string> = {
  active_call: '#16a34a',
  post_call: '#65a30d',
  waiting: '#facc15',
  idle: '#94a3b8',
  break: '#f87171',
}

export function HeatmapTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const urlState = readHeatmapBarState(searchParams)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const filters = toHeatmapFilters(urlState)
  const periodReady =
    urlState.period !== 'custom' || !!(urlState.customFromDate && urlState.customToDate)

  const { data, isLoading, isError } = useHeatmap(filters, periodReady)
  const exportMutation = useExportHeatmap()

  const operatorById = useMemo(() => {
    const m = new Map<number, string>()
    operators.forEach((o) => {
      const name = [o.first_name, o.last_name].filter(Boolean).join(' ') || o.username
      m.set(o.id, name)
    })
    return m
  }, [operators])

  const apply = (next: HeatmapBarState) => {
    setSearchParams(writeHeatmapBarState(searchParams, next), { replace: true })
  }

  const handleStateChange = (value: string) => {
    const allowed: HeatmapState[] = ['active_call', 'post_call', 'waiting', 'idle', 'break']
    const next: HeatmapBarState = {
      ...urlState,
      state_filter: value === 'all' ? undefined : (value as HeatmapState),
    }
    if (allowed.includes(value as HeatmapState) || value === 'all') {
      apply(next)
    }
  }

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync(filters)
    } catch (err) {
      console.error('Heatmap export failed', err)
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
    }
  }

  const stateFilterControl = (
    <div className="flex flex-col gap-1.5">
      <span className="text-dark-500 text-xs font-medium sm:text-sm">
        {t('pages.actionAnalysis.heatmap.filters.state', 'State filter')}
      </span>
      <Select value={urlState.state_filter ?? 'all'} onValueChange={handleStateChange}>
        <SelectTrigger className="h-[45px] w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {t('pages.actionAnalysis.heatmap.states.all', 'All states')}
          </SelectItem>
          <SelectItem value="active_call">
            {t('pages.actionAnalysis.heatmap.states.active_call', 'Active call')}
          </SelectItem>
          <SelectItem value="post_call">
            {t('pages.actionAnalysis.heatmap.states.post_call', 'Post-call')}
          </SelectItem>
          <SelectItem value="waiting">
            {t('pages.actionAnalysis.heatmap.states.waiting', 'Waiting')}
          </SelectItem>
          <SelectItem value="idle">
            {t('pages.actionAnalysis.heatmap.states.idle', 'Idle')}
          </SelectItem>
          <SelectItem value="break">
            {t('pages.actionAnalysis.heatmap.states.break', 'Break')}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  const operatorList = useMemo(() => data?.operators ?? [], [data])
  const allHours = useMemo(() => {
    const set = new Set<string>()
    operatorList.forEach((op) => op.hours.forEach((h) => set.add(h.hour)))
    return [...set].sort()
  }, [operatorList])

  return (
    <div className="flex flex-col gap-4">
      <AnalyticsFiltersBar
        value={urlState}
        operators={operators}
        onApply={apply}
        onClear={() => setSearchParams(new URLSearchParams(), { replace: true })}
        trailing={stateFilterControl}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleExport}
          disabled={!periodReady || exportMutation.isPending || !operatorList.length}
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
          {t('pages.actionAnalysis.errors.loadHeatmapFailed', 'Failed to load the heatmap.')}
        </div>
      ) : isLoading ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t('common.loading', 'Loading...')}
        </div>
      ) : !operatorList.length ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t('pages.actionAnalysis.heatmap.empty', 'No heatmap data for the selected filters.')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white/80 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 pb-3">
            {(['active_call', 'post_call', 'waiting', 'idle', 'break'] as HeatmapState[]).map(
              (state) => (
                <span
                  key={state}
                  className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATE_COLORS[state] }}
                  />
                  {t(`pages.actionAnalysis.heatmap.states.${state}`, state)}
                </span>
              )
            )}
          </div>
          <table className="w-full text-xs">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="sticky left-0 bg-white/80 px-2 py-2">
                  {t('pages.actionAnalysis.heatmap.operator', 'Operator')}
                </th>
                {allHours.map((hour) => (
                  <th key={hour} className="px-1 py-2 font-mono text-[10px]">
                    {new Date(hour).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      hour12: false,
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operatorList.map((op) => {
                const byHour = new Map(op.hours.map((h) => [h.hour, h]))
                return (
                  <tr key={op.operator_id} className="border-t border-gray-100">
                    <td className="sticky left-0 bg-white/80 px-2 py-1 font-medium text-gray-800">
                      {operatorById.get(op.operator_id) ?? `#${op.operator_id}`}
                    </td>
                    {allHours.map((hour) => {
                      const bucket = byHour.get(hour)
                      const color = bucket ? STATE_COLORS[bucket.dominant_state] : '#f3f4f6'
                      const tooltip = bucket
                        ? `${bucket.dominant_state} • a:${bucket.minute_breakdown.active_call} p:${bucket.minute_breakdown.post_call} w:${bucket.minute_breakdown.waiting} i:${bucket.minute_breakdown.idle} b:${bucket.minute_breakdown.break}`
                        : 'no data'
                      return (
                        <td key={hour} className="px-0.5 py-0.5">
                          <div
                            title={tooltip}
                            className="h-6 w-6 rounded-sm"
                            style={{ backgroundColor: color }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
