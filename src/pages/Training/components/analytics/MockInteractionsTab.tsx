import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_INTERACTIONS,
  type InteractionSource,
  type MockInteractionRow,
} from '../../mocks/trainerWorkplaceMocks'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Mock Interactions sub-tab (Action Analysis Tab 1). Matches the Figma frame:
 *   filter strip: radio period chips + All operators dropdown + All statuses
 *   dropdown + Reset button
 *   table: Date/Time · Operator · Duration · Status · Break to next · Client ·
 *   Deal · Amount promised
 */

type InteractionPeriod = 'today' | 'yesterday' | '7d' | '30d'

const PERIODS: { id: InteractionPeriod; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
]

const SOURCE_TONE: Record<InteractionSource, string> = {
  Promise: 'bg-[#ECFDF5] text-[#047857]',
  'Missed call': 'bg-[#FEF2F2] text-[#B91C1C]',
  Refusal: 'bg-[#FFEDD5] text-[#C2410C]',
  'Will pass': 'bg-[#FEF9C3] text-[#A16207]',
  Positive: 'bg-[#EFF6FF] text-[#1D4ED8]',
}

const ALL_OPERATORS = Array.from(new Set(MOCK_INTERACTIONS.map((row) => row.operator))).sort()
const ALL_SOURCES: InteractionSource[] = [
  'Promise',
  'Missed call',
  'Refusal',
  'Will pass',
  'Positive',
]

export function MockInteractionsTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<InteractionPeriod>('today')
  const [operatorFilter, setOperatorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | InteractionSource>('all')

  const filteredRows = MOCK_INTERACTIONS.filter((row) => {
    if (operatorFilter !== 'all' && row.operator !== operatorFilter) return false
    if (statusFilter !== 'all' && row.source !== statusFilter) return false
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
      {/* Filter strip — radio period chips + operator/status dropdowns + Reset */}
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

        {/* Operator dropdown */}
        <div className="relative ml-2 min-w-[180px] flex-1 sm:flex-none">
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.interactions.filters.allOperators', 'All operators')}
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

        {/* Status dropdown */}
        <div className="relative min-w-[160px] flex-1 sm:flex-none">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | InteractionSource)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.interactions.filters.allStatuses', 'All statuses')}
            </option>
            {ALL_SOURCES.map((src) => (
              <option key={src} value={src}>
                {src}
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
          {t('pages.training.interactions.filters.reset', 'Reset')}
        </button>
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.interactions.cols.date', 'Date / Time')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.interactions.cols.operator', 'Operator')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.interactions.cols.duration', 'Duration')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.interactions.cols.status', 'Status')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.interactions.cols.breakToNext', 'Break to next.')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.interactions.cols.client', 'Client')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.interactions.cols.deal', 'Deal')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.interactions.cols.amountPromised', 'Amount promised')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.interactions.empty', 'No interactions match the filters.')}
              </td>
            </tr>
          ) : (
            filteredRows.map((row) => <InteractionRow key={row.id} row={row} />)
          )}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function InteractionRow({ row }: { row: MockInteractionRow }) {
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>{row.dateLabel}</td>
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
      <td className={ANALYTICS_TABLE_TD}>{row.duration}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SOURCE_TONE[row.source]}`}
        >
          {row.source}
        </span>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.breakInRowLabel}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-[#3B82F6]`}>{row.client}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.deal}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-right font-medium`}>
        {row.amountPromised != null ? `${row.amountPromised.toLocaleString()} ₴` : '—'}
      </td>
    </tr>
  )
}

export default MockInteractionsTab
