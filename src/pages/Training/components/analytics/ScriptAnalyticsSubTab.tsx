import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useStageFunnel } from '@/features/quality'
import type { FunnelDateType, StageFunnelFilters } from '@/features/quality'
import { StageFunnel } from './funnel/StageFunnel'
import { PainPointsPanel } from './funnel/PainPointsPanel'

type FunnelPeriod = 'today' | 'yesterday' | '7d' | '30d'

const PERIODS: { id: FunnelPeriod; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
]

const PERIOD_TO_BACKEND: Record<FunnelPeriod, string> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last_7d',
  '30d': 'last_30d',
}

export function ScriptAnalyticsSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<FunnelPeriod>('7d')
  const [dateType, setDateType] = useState<FunnelDateType>('evaluation')
  const [operatorFilter, setOperatorFilter] = useState<'all' | string>('all')

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)

  const filters = useMemo<StageFunnelFilters>(() => {
    const operatorId = operatorFilter !== 'all' ? Number(operatorFilter) : undefined
    return {
      period: PERIOD_TO_BACKEND[period],
      date_type: dateType,
      operator_ids: operatorId != null && Number.isFinite(operatorId) ? [operatorId] : undefined,
    }
  }, [period, dateType, operatorFilter])

  const funnelQuery = useStageFunnel(filters, projectIdNum != null)
  const data = funnelQuery.data
  const isEmpty = !!data && data.evaluated_calls === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <span className="text-xs font-medium tracking-[-0.02em] text-[#05040D]">
          {t('pages.training.period.label', 'Period')}:
        </span>
        <div className="flex flex-wrap items-center gap-4">
          {PERIODS.map((p) => {
            const isActive = p.id === period
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#05040D]"
              >
                <span
                  className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border ${
                    isActive ? 'border-[#22C55E] bg-white' : 'border-[#DFDFDF] bg-white'
                  }`}
                >
                  {isActive ? <span className="block h-2 w-2 rounded-full bg-[#22C55E]" /> : null}
                </span>
                <span className={isActive ? 'text-[#05040D]' : 'text-[#676767]'}>
                  {t(p.key, p.fallback)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-medium text-[#05040D]">
            {t('pages.training.funnel.dateType.label', 'Date type')}:
          </span>
          <div className="relative min-w-[150px]">
            <select
              value={dateType}
              onChange={(e) => setDateType(e.target.value as FunnelDateType)}
              className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
            >
              <option value="evaluation">
                {t('pages.training.funnel.dateType.evaluation', 'Evaluation date')}
              </option>
              <option value="call">{t('pages.training.funnel.dateType.call', 'Call date')}</option>
            </select>
            <Icons.ArrowDown
              size={12}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
            />
          </div>
        </div>

        <div className="relative min-w-[180px] flex-1 sm:flex-none">
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.interactions.filters.allOperators', 'All operators')}
            </option>
            {operators.map((op) => (
              <option key={op.id} value={String(op.id)}>
                {op.full_name}
              </option>
            ))}
          </select>
          <Icons.ArrowDown
            size={12}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
          />
        </div>
      </div>

      {funnelQuery.isLoading ? (
        <div className="rounded-xl border border-[#EBECE8] bg-white px-4 py-10 text-center text-xs text-[#676767] shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
          {t('pages.training.funnel.loading', 'Loading funnel…')}
        </div>
      ) : funnelQuery.isError ? (
        <div className="rounded-xl border border-[#EBECE8] bg-white px-4 py-10 text-center text-xs text-[#EF4444] shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
          {t('pages.training.funnel.loadFailed', 'Failed to load script stage funnel.')}
        </div>
      ) : isEmpty ? (
        <EmptyFunnelState />
      ) : data ? (
        <>
          <StageFunnel data={data} />
          <PainPointsPanel painPoints={data.pain_points} />
        </>
      ) : null}
    </div>
  )
}

function EmptyFunnelState() {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#D1D5DB] bg-white px-4 py-12 text-center shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <Icons.Info size={20} className="text-[#9CA3AF]" />
      <h3 className="text-sm font-semibold text-[#05040D]">
        {t('pages.training.funnel.empty.title', 'No scored stage data yet')}
      </h3>
      <p className="max-w-md text-[11px] leading-relaxed text-[#676767]">
        {t(
          'pages.training.funnel.empty.body',
          'The funnel is built from calls a trainer scored against the "Script stages" section. Once trainers mark stages on evaluated calls, drop-off will appear here.'
        )}
      </p>
      <span className="mt-1 rounded-full bg-[#F3F4F6] px-3 py-1 text-[11px] font-semibold text-[#676767]">
        {t('pages.training.funnel.evaluatedCalls', '{{count}} scored calls', { count: 0 })}
      </span>
    </div>
  )
}

export default ScriptAnalyticsSubTab
