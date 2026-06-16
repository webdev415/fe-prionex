import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_CLOSURES,
  MOCK_CLOSURES_FUNNEL,
  MOCK_CLOSURES_KPIS,
  type MockClosureRow,
} from '../../mocks/trainerWorkplaceMocks'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Successful Closures sub-tab (KAN-415). Mirrors the Figma frame:
 *   1) 4 horizontal icon-tile KPIs
 *   2) Funnel card — 3 horizontal stage cells with unit-bar visualization
 *   3) Filter strip — period radios + All operators dropdown + All statuses
 *      dropdown + Reset
 *   4) Closures table — date+time, operator avatar+name, blue client link,
 *      deal code, payment amount (bold), Paid pill with check icon
 */

type PeriodOption = 'today' | 'yesterday' | '7d' | '30d'

const PERIODS: { id: PeriodOption; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
]

const ALL_OPERATORS = Array.from(new Set(MOCK_CLOSURES.map((row) => row.operator))).sort()
const ALL_STATUSES = Array.from(new Set(MOCK_CLOSURES.map((row) => row.statusInCrm)))

/** Inline trophy SVG — no trophy glyph in the Icons module. */
function TrophyIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M6 3h8v3c0 2.2-1.8 4-4 4s-4-1.8-4-4V3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M6 5H4a1 1 0 0 0-1 1v1c0 1.1.9 2 2 2h1M14 5h2a1 1 0 0 1 1 1v1c0 1.1-.9 2-2 2h-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 10v3M7 16h6M8 13h4l-.5 3h-3L8 13z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SuccessfulClosuresSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [operatorFilter, setOperatorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const k = MOCK_CLOSURES_KPIS

  const filteredRows = MOCK_CLOSURES.filter((row) => {
    if (operatorFilter !== 'all' && row.operator !== operatorFilter) return false
    if (statusFilter !== 'all' && row.statusInCrm !== statusFilter) return false
    return true
  })

  const isDefault = period === 'today' && operatorFilter === 'all' && statusFilter === 'all'

  const handleReset = () => {
    setPeriod('today')
    setOperatorFilter('all')
    setStatusFilter('all')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — 4 horizontal icon-tile KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.closures', 'Successful Closures')}
          value={String(k.successfulClosures)}
          icon={<Icons.Success size={18} />}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#22C55E]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.totalAmount', 'Total Amount')}
          value={`${k.totalAmount.amount.toLocaleString()} ${k.totalAmount.currency}`}
          icon={<span className="text-lg leading-none font-semibold">Σ</span>}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.conversion', 'Conversion promise→payment')}
          value={`${k.conversionPromisePaymentPct}%`}
          valueTone="text-[#8B5CF6]"
          icon={<Icons.ChartRing size={18} />}
          iconBg="bg-[#F5F3FF]"
          iconTone="text-[#8B5CF6]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.leader', 'Closure Leader')}
          value={k.closureLeader}
          subValue={k.closureLeaderSubValue}
          valueTone="text-[#05040D]"
          icon={<TrophyIcon size={18} />}
          iconBg="bg-[#FEFCE8]"
          iconTone="text-[#CA8A04]"
        />
      </div>

      {/* Funnel card — single white card with 3 stage cells */}
      <div className="rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#05040D]">
            {t(
              'pages.training.closures.funnel.title',
              'Funnel: interactions → promises → payments'
            )}
          </h3>
          <span className="text-[11px] text-[#676767]">
            {t('pages.training.closures.funnel.period', 'Today · all operators')}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {MOCK_CLOSURES_FUNNEL.map((stage) => {
            const filledSegments = Math.round((stage.pct / 100) * 10)
            return (
              <div
                key={stage.label}
                className="flex flex-col gap-2 rounded-lg bg-[#F7F7F7] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-2xl leading-none font-semibold text-[#05040D]">
                      {stage.actual}
                    </span>
                    <span className="mt-1 text-[11px] font-medium text-[#676767]">
                      {stage.label}
                    </span>
                  </div>
                  <div className="flex h-4 items-center gap-0.5">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <span
                        key={j}
                        className={`h-full w-1.5 rounded-sm ${
                          j < filledSegments ? 'bg-[#204E4D]' : 'bg-[#EDEDED]'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-right text-[11px] font-medium text-[#676767]">
                  {stage.pct}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter strip — periods + operator + status + reset */}
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

        <div className="relative ml-2 min-w-[180px] flex-1 sm:flex-none">
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.closures.filters.allOperators', 'All operators')}
            </option>
            {ALL_OPERATORS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <Icons.ArrowDown
            size={12}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
          />
        </div>

        <div className="relative min-w-[160px] flex-1 sm:flex-none">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.closures.filters.allStatuses', 'All statuses')}
            </option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Icons.ArrowDown
            size={12}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
          />
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={isDefault}
          className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
            isDefault ? 'cursor-not-allowed text-[#A1A1A1]' : 'text-[#05040D] hover:text-[#204E4D]'
          }`}
        >
          <Icons.Close size={12} className={isDefault ? 'text-[#A1A1A1]' : 'text-[#05040D]'} />
          {t('pages.training.closures.filters.reset', 'Reset')}
        </button>
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.date', 'Closure Date')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.operator', 'Operator')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.client', 'Client')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>{t('pages.training.closures.cols.deal', 'Deal')}</th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.amount', 'Payment Amount')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.status', 'Status in CRM')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <ClosureRow key={row.id} row={row} />
          ))}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function ClosureRow({ row }: { row: MockClosureRow }) {
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>{row.closureDateLabel}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          {row.operatorInitials ? (
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
              style={{ backgroundColor: row.operatorAvatarColor ?? '#EDEDED' }}
            >
              {row.operatorInitials}
            </span>
          ) : null}
          <span className="text-xs font-medium text-[#05040D]">{row.operator}</span>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-[#3B82F6]`}>{row.client}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.deal}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-semibold text-[#05040D]`}>
        {row.paymentAmount.toLocaleString()} ₴
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          <Icons.Success size={10} />
          {row.statusInCrm}
        </span>
      </td>
    </tr>
  )
}

export default SuccessfulClosuresSubTab
