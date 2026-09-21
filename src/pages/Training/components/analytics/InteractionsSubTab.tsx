import { memo, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { formatDateTime, formatNumber } from '@/lib/localeFormat'
import { Pagination } from '@/components/ui/Pagination'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useInteractionMonitoring } from '@/features/training/hooks/useInteractionMonitoring'
import { useInteractionResults } from '@/features/clients/hooks/useNoteInteraction'
import type {
  CallMonitoringPeriod,
  InteractionMonitoringFilters,
  InteractionMonitoringItem,
} from '@/features/training/types'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'
import { InteractionsKpiStrip } from './InteractionsKpiStrip'
import { withCurrency } from '@/lib/formatters'
import { piiProps } from '@/lib/openreplay/pii'
import { PiiTooltip } from '@/components/ui/PiiTooltip'

/**
 * Interactions sub-tab (KAN-731 Block 1 — wired to /api/v1/interactions).
 *
 * UI parity with the prior MockInteractionsTab is preserved: period radio
 * chips, operator + status dropdowns, Reset button, and the 8-column table
 * with the Source / Status colored pill. Columns that have no analogue on
 * the BE response (Duration, Break to next) render `—` for now.
 */

type InteractionPeriod = 'today' | 'yesterday' | '7d' | '30d'

const PERIODS: { id: InteractionPeriod; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
]

// Maps the radio UI value to the BE `CallMonitoringPeriod` vocabulary.
const PERIOD_TO_BACKEND: Record<InteractionPeriod, CallMonitoringPeriod> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last_7d',
  '30d': 'last_30d',
}

// Keyword-based tone mapping for the status pill — works against the BE's
// free-form `result_name` without depending on a fixed id list.
const TONE_KEYWORDS: { tone: string; keywords: string[] }[] = [
  {
    tone: 'bg-[#ECFDF5] text-[#047857]',
    keywords: ['promise', 'обіцянк', 'обещание', 'pay', 'promesa', 'pago'],
  },
  {
    tone: 'bg-[#FEF2F2] text-[#B91C1C]',
    keywords: [
      'missed',
      'no answer',
      'no_answer',
      'пропущ',
      'без відпов',
      'без ответа',
      'sin respuesta',
      'no contesta',
    ],
  },
  {
    tone: 'bg-[#FFEDD5] text-[#C2410C]',
    keywords: ['refus', 'відмов', 'отказ', 'rechaz', 'se niega'],
  },
  {
    tone: 'bg-[#FEF9C3] text-[#A16207]',
    keywords: ['will pass', 'will_pass', 'передаст', 'передасть', 'transmitir', 'pasará'],
  },
  {
    tone: 'bg-[#EFF6FF] text-[#1D4ED8]',
    keywords: ['positive'],
  },
]

function toneForResult(resultName: string | null): string {
  if (!resultName) return 'bg-[#F3F4F6] text-[#374151]'
  const lower = resultName.toLowerCase()
  for (const entry of TONE_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.tone
  }
  return 'bg-[#F3F4F6] text-[#374151]'
}

const AVATAR_PALETTE = [
  '#E0F2EC',
  '#FEF3C7',
  '#FEE4E2',
  '#E0E7FF',
  '#FCE7F3',
  '#DBEAFE',
  '#FFEDD5',
  '#D1FAE5',
]

function deriveInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function avatarColorFor(operatorId: number | null): string {
  if (operatorId == null) return '#EDEDED'
  return AVATAR_PALETTE[Math.abs(operatorId) % AVATAR_PALETTE.length]
}

function formatInteractionDate(iso: string, language: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return formatDateTime(d, language)
}

function formatAmount(raw: string | null, language: string): string {
  if (raw == null) return '—'
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  return withCurrency(formatNumber(n, language), 'suffix')
}

export function InteractionsSubTab() {
  const { t, i18n } = useTranslation('common')
  const [period, setPeriod] = useState<InteractionPeriod>('today')
  const [operatorFilter, setOperatorFilter] = useState<'all' | string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // A filter change invalidates the current page offset — these setters reset
  // back to page 1 alongside the filter update.
  const changePeriod = (p: InteractionPeriod) => {
    setPeriod(p)
    setPage(1)
  }
  const changeOperator = (value: string) => {
    setOperatorFilter(value)
    setPage(1)
  }
  const changeStatus = (value: string) => {
    setStatusFilter(value)
    setPage(1)
  }

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)
  const { data: resultOptions = [] } = useInteractionResults()

  const filters = useMemo<InteractionMonitoringFilters>(() => {
    // The select carries the operator id itself. Resolving it from
    // `full_name` through a Map — as this did — fails silently in two ways: an
    // unresolvable label yields `undefined`, which the BE reads as "every
    // operator" rather than as an empty result, and two employees sharing a
    // name collapse onto whichever id the Map kept last.
    const userId = operatorFilter !== 'all' ? Number(operatorFilter) : undefined
    const resultId = statusFilter !== 'all' ? Number(statusFilter) : undefined
    return {
      period: PERIOD_TO_BACKEND[period],
      user_ids: Number.isFinite(userId) ? [userId as number] : undefined,
      result_ids: resultId != null && Number.isFinite(resultId) ? [resultId] : undefined,
      sort_by: 'date',
      sort_dir: 'desc',
      page,
      page_size: pageSize,
    }
  }, [period, operatorFilter, statusFilter, page, pageSize])

  const interactionsQuery = useInteractionMonitoring(filters, projectIdNum != null)

  const items = interactionsQuery.data?.items ?? []
  const total = interactionsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const isDefault = period === 'today' && operatorFilter === 'all' && statusFilter === 'all'

  const handleReset = () => {
    setPeriod('today')
    setOperatorFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — shares the same query result as the table below
       *  (rather than firing a second 500-row request). Bucket counters
       *  render `—` until /interactions/summary aggregate ships. */}
      <InteractionsKpiStrip
        total={interactionsQuery.data?.total ?? 0}
        isLoading={interactionsQuery.isLoading}
        isError={interactionsQuery.isError}
      />

      {/* Filter strip — period chips + operator/status dropdowns + Reset */}
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
                onClick={() => changePeriod(p.id)}
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
            onChange={(e) => changeOperator(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.interactions.filters.allOperators', 'All operators')}
            </option>
            {operators.map((op) => (
              <option key={op.id} value={String(op.id)} {...piiProps}>
                {op.full_name}
              </option>
            ))}
          </select>
          <Icons.ArrowDown
            size={12}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
          />
        </div>

        {/* Status (= result) dropdown */}
        <div className="relative min-w-[160px] flex-1 sm:flex-none">
          <select
            value={statusFilter}
            onChange={(e) => changeStatus(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.interactions.filters.allStatuses', 'All statuses')}
            </option>
            {resultOptions.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
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
          {interactionsQuery.isLoading ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.interactions.loading', 'Loading…')}
              </td>
            </tr>
          ) : interactionsQuery.isError ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-[11px] text-[#EF4444]">
                {t(
                  'pages.training.interactions.loadFailed',
                  'Failed to load interactions. Please retry.'
                )}
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.interactions.empty', 'No interactions match the filters.')}
              </td>
            </tr>
          ) : (
            items.map((row) => <InteractionRow key={row.id} row={row} language={i18n.language} />)
          )}
        </tbody>
      </AnalyticsMockTable>

      {total > pageSize ? (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}
    </div>
  )
}

/** Memoized so a filter / dropdown change on the parent doesn't repaint
 *  every row when its `row` reference is unchanged. */
const InteractionRow = memo(
  InteractionRowImpl,
  (prev, next) => prev.row === next.row && prev.language === next.language
)

function InteractionRowImpl({
  row,
  language,
}: {
  row: InteractionMonitoringItem
  language: string
}) {
  const navigate = useNavigate()
  const operatorName = row.user_name ?? (row.user_id ? `#${row.user_id}` : '—')
  const initials =
    operatorName === '—'
      ? ''
      : deriveInitials(operatorName === `#${row.user_id}` ? '' : operatorName)
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>
        {formatInteractionDate(row.interaction_date, language)}
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          {initials ? (
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
              style={{ backgroundColor: avatarColorFor(row.user_id) }}
            >
              {initials}
            </span>
          ) : null}
          <span className="text-xs font-medium text-[#05040D]" {...piiProps}>
            {operatorName}
          </span>
        </div>
      </td>
      <td className={ANALYTICS_TABLE_TD}>—</td>
      <td className={ANALYTICS_TABLE_TD}>
        {row.result_name ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneForResult(row.result_name)}`}
          >
            {row.result_name}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={ANALYTICS_TABLE_TD}>—</td>
      <td className={ANALYTICS_TABLE_TD}>
        <PiiTooltip label={row.client_full_name}>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/clients/${row.client_id}`)}
            className="text-[#3B82F6] hover:underline"
          >
            #{row.client_id}
          </button>
        </PiiTooltip>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.contract_number ?? '—'}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-right font-medium`}>
        {formatAmount(row.promise_to_pay_amount, language)}
      </td>
    </tr>
  )
}

export default InteractionsSubTab
