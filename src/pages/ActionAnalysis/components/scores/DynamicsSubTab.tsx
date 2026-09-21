/**
 * DynamicsSubTab — operator score-dynamics chart (KAN-410, Feature 2.4).
 *
 * Lets a trainer pick an operator and a period and renders the Recharts
 * line chart with operator + team-average lines plus a quick stats row
 * (period avg / min / max / scorecard count) and an xlsx export.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'
import {
  ScoreDynamicsChart,
  useExportOperatorDynamics,
  useOperatorDynamics,
} from '@/features/quality'
import type { DynamicsGranularity } from '@/features/quality'
import { piiProps } from '@/lib/openreplay/pii'

const GRANULARITIES: DynamicsGranularity[] = ['day', 'week', 'month']
const PERIODS = ['last_7d', 'last_30d'] as const

export function DynamicsSubTab() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const [operatorId, setOperatorId] = useState<number | null>(null)
  const [granularity, setGranularity] = useState<DynamicsGranularity>('week')
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('last_30d')

  const filters = useMemo(
    () => (operatorId == null ? null : { operator_id: operatorId, granularity, period }),
    [operatorId, granularity, period]
  )

  const dynamicsQuery = useOperatorDynamics(filters ?? { operator_id: -1 }, filters != null)
  const exportMutation = useExportOperatorDynamics()

  if (!operators.length) {
    return (
      <div className="bg-card/50 text-muted-foreground rounded-xl p-12 text-center text-sm shadow-sm">
        {t('pages.actionAnalysis.errors.noOperators', 'No operators in scope.')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground text-sm">
              {t('pages.actionAnalysis.filters.operator', 'Operator')}
            </label>
            <select
              value={operatorId ?? ''}
              onChange={(e) => setOperatorId(e.target.value ? Number(e.target.value) : null)}
              className="border-border rounded-lg border px-3 py-1.5 text-sm"
            >
              <option value="">
                {t('pages.actionAnalysis.filters.selectOperator', 'Select an operator…')}
              </option>
              {operators.map((op) => (
                /* The attribute goes on the <option> itself: <Pii> is not a
                   valid child of <select>, and an option's text is a text node
                   like any other. */
                <option key={op.id} value={op.id} {...piiProps}>
                  {op.full_name ?? `#${op.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-muted-foreground text-sm">
              {t('pages.actionAnalysis.filters.period', 'Period')}
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as (typeof PERIODS)[number])}
              className="border-border rounded-lg border px-3 py-1.5 text-sm"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`pages.actionAnalysis.filters.periods.${p}`, p)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-muted-foreground text-sm">
              {t('pages.actionAnalysis.filters.granularity', 'Granularity')}
            </label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as DynamicsGranularity)}
              className="border-border rounded-lg border px-3 py-1.5 text-sm"
            >
              {GRANULARITIES.map((g) => (
                <option key={g} value={g}>
                  {t(`pages.actionAnalysis.dynamics.granularity.${g}`, g)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => filters && exportMutation.mutate(filters)}
          disabled={!filters || exportMutation.isPending}
          leftIcon={<Icons.Download size={16} className="text-primary-foreground" />}
          className="h-[40px] rounded-full text-xs"
        >
          {exportMutation.isPending
            ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
            : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      {operatorId == null ? (
        <div className="bg-card/50 text-muted-foreground rounded-xl p-12 text-center text-sm shadow-sm">
          {t(
            'pages.actionAnalysis.dynamics.selectOperatorHint',
            'Pick an operator to view their score dynamics.'
          )}
        </div>
      ) : dynamicsQuery.isLoading ? (
        <div className="bg-card/50 text-muted-foreground rounded-xl p-12 text-center text-sm shadow-sm">
          {t('common.loading', 'Loading…')}
        </div>
      ) : dynamicsQuery.isError ? (
        <div className="bg-card/50 text-error-700 rounded-xl p-12 text-center text-sm shadow-sm">
          {t('pages.actionAnalysis.errors.loadDynamicsFailed', 'Failed to load dynamics')}
        </div>
      ) : dynamicsQuery.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label={t('pages.actionAnalysis.dynamics.periodAvg', 'Period avg')}
              value={dynamicsQuery.data.period_avg}
            />
            <Stat
              label={t('pages.actionAnalysis.dynamics.periodMin', 'Min')}
              value={dynamicsQuery.data.period_min}
            />
            <Stat
              label={t('pages.actionAnalysis.dynamics.periodMax', 'Max')}
              value={dynamicsQuery.data.period_max}
            />
            <Stat
              label={t('pages.actionAnalysis.dynamics.scorecardCount', 'Scorecards')}
              value={dynamicsQuery.data.scorecard_count}
              isCount
            />
          </div>

          <ScoreDynamicsChart data={dynamicsQuery.data} />
        </>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  isCount,
}: {
  label: string
  value: number | null
  isCount?: boolean
}) {
  return (
    <div className="bg-card rounded-lg px-3 py-2 shadow-sm">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-foreground text-lg font-medium">
        {value == null ? '—' : isCount ? value : Number(value).toFixed(2)}
      </div>
    </div>
  )
}
