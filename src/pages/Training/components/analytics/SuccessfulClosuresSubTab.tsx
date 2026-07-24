import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Pagination } from '@/components/ui/Pagination'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useSuccessfulClosures } from '@/features/training/hooks/useSuccessfulClosures'
import { useInteractionMonitoring } from '@/features/training/hooks/useInteractionMonitoring'
import { usePromisesAndCallbacks } from '@/features/training/hooks/usePromisesAndCallbacks'
import type { CallMonitoringPeriod, ClosureFilters, ClosureItem } from '@/features/training/types'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Successful Closures sub-tab (KAN-734). Trainer-facing list of VERIFIED
 * payments scoped to the trainer's team. The Figma layout is preserved:
 *   1) 4 horizontal icon-tile KPIs
 *   2) Funnel card — Interactions → Promises → Payments
 *   3) Filter strip — period radios + operator dropdown + status + Reset
 *   4) Closures table — date, operator, client (id link), deal, amount,
 *      confirmation date, status pill
 *
 * Data sources:
 *   - cards (count / total amount) + closure leader  ← /api/v1/payments/closures
 *   - funnel + conversion % are composed from the interaction-monitoring and
 *     promises endpoints (those counts live in client-service), since closures
 *     itself only knows the verified-payments side of the funnel.
 */

type PeriodOption = 'today' | 'yesterday' | '7d' | '30d'

const PERIODS: { id: PeriodOption; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
]

// Maps the radio UI value to the BE period vocabulary.
const PERIOD_TO_BACKEND: Record<PeriodOption, CallMonitoringPeriod> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last_7d',
  '30d': 'last_30d',
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

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function avatarColorFor(operatorId: number | null): string {
  if (operatorId == null) return '#EDEDED'
  return AVATAR_PALETTE[Math.abs(operatorId) % AVATAR_PALETTE.length]
}

/** YYYY-MM-DD → DD/MM/YYYY (payment_date / confirmation_date are plain dates). */
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatAmount(raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  return `${n.toLocaleString()} ₴`
}

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
  const navigate = useNavigate()
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [operatorFilter, setOperatorFilter] = useState<'all' | string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Server-side filters (period/operator) invalidate the page offset, so their
  // setters reset to page 1. The status filter is client-side over the current
  // page, so it intentionally leaves the page unchanged.
  const changePeriod = (p: PeriodOption) => {
    setPeriod(p)
    setPage(1)
  }
  const changeOperator = (value: string) => {
    setOperatorFilter(value)
    setPage(1)
  }

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)

  const operatorIdByLabel = useMemo(() => {
    const m = new Map<string, number>()
    operators.forEach((op) => m.set(op.full_name, op.id))
    return m
  }, [operators])

  // The closures endpoint (payment-service) doesn't enrich operator_name, so we
  // resolve it from the project operator list by id — matching how the other
  // sub-tabs surface the operator name + avatar instead of a bare #id.
  const operatorNameById = useMemo(() => {
    const m = new Map<number, string>()
    operators.forEach((op) => m.set(op.id, op.full_name))
    return m
  }, [operators])

  const userIds = useMemo<number[] | undefined>(() => {
    if (operatorFilter === 'all') return undefined
    const id = operatorIdByLabel.get(operatorFilter)
    return id != null ? [id] : undefined
  }, [operatorFilter, operatorIdByLabel])

  const backendPeriod = PERIOD_TO_BACKEND[period]

  const closureFilters = useMemo<ClosureFilters>(
    () => ({
      period: backendPeriod,
      user_ids: userIds,
      sort_by: 'date',
      sort_dir: 'desc',
      page,
      page_size: pageSize,
    }),
    [backendPeriod, userIds, page, pageSize]
  )

  const enabled = projectIdNum != null
  const closuresQuery = useSuccessfulClosures(closureFilters, enabled)
  // Funnel context — only the totals are needed, so request a single row.
  const interactionsQuery = useInteractionMonitoring(
    {
      period: backendPeriod,
      user_ids: userIds,
      sort_by: 'date',
      sort_dir: 'desc',
      page: 1,
      page_size: 1,
    },
    enabled
  )
  const promisesQuery = usePromisesAndCallbacks(
    {
      period: backendPeriod,
      user_ids: userIds,
      sort_by: 'date',
      sort_dir: 'desc',
      page: 1,
      page_size: 1,
    },
    enabled
  )

  const cards = closuresQuery.data?.summary_cards
  const leader = closuresQuery.data?.closure_leader ?? null
  const closuresCount = cards?.successful_closures_count ?? 0
  const interactionsTotal = interactionsQuery.data?.total ?? 0
  const promisesTotal = promisesQuery.data?.total ?? 0
  const conversionPct = promisesTotal > 0 ? Math.round((closuresCount / promisesTotal) * 100) : 0

  const funnelStages = useMemo(() => {
    const pct = (n: number) =>
      interactionsTotal > 0 ? Math.round((n / interactionsTotal) * 100) : 0
    return [
      {
        label: t('pages.training.closures.funnel.interactions', 'Interactions'),
        actual: interactionsTotal,
        pct: pct(interactionsTotal),
      },
      {
        label: t('pages.training.closures.funnel.promises', 'Promises'),
        actual: promisesTotal,
        pct: pct(promisesTotal),
      },
      {
        label: t('pages.training.closures.funnel.payments', 'Payments'),
        actual: closuresCount,
        pct: pct(closuresCount),
      },
    ]
  }, [interactionsTotal, promisesTotal, closuresCount, t])

  const rows = useMemo(() => closuresQuery.data?.items ?? [], [closuresQuery.data])
  const total = closuresQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const statusOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.status))), [rows])
  const filteredRows = useMemo(
    () => (statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter]
  )

  const isDefault = period === 'today' && operatorFilter === 'all' && statusFilter === 'all'

  const handleReset = () => {
    setPeriod('today')
    setOperatorFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — 4 horizontal icon-tile KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.closures', 'Successful Closures')}
          value={String(closuresCount)}
          icon={<Icons.Success size={18} />}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#22C55E]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.totalAmount', 'Total Amount')}
          value={formatAmount(cards?.total_amount ?? '0')}
          icon={<span className="text-lg leading-none font-semibold">Σ</span>}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.conversion', 'Conversion promise→payment')}
          value={`${conversionPct}%`}
          valueTone="text-[#8B5CF6]"
          icon={<Icons.ChartRing size={18} />}
          iconBg="bg-[#F5F3FF]"
          iconTone="text-[#8B5CF6]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.leader', 'Closure Leader')}
          value={leader?.operator_name ?? (leader ? `#${leader.operator_id}` : '—')}
          subValue={
            leader
              ? t('pages.training.closures.kpi.leaderSub', '{{count}} closures', {
                  count: leader.closures_count,
                })
              : undefined
          }
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
            {t(PERIODS.find((p) => p.id === period)?.key ?? '', period)}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {funnelStages.map((stage) => {
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

        <div className="relative ml-2 min-w-[180px] flex-1 sm:flex-none">
          <select
            value={operatorFilter}
            onChange={(e) => changeOperator(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.closures.filters.allOperators', 'All operators')}
            </option>
            {operators.map((op) => (
              <option key={op.id} value={op.full_name}>
                {op.full_name}
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
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {t(`pages.training.closures.status.${s}`, s)}
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
              {t('pages.training.closures.cols.confirmationDate', 'Confirmation Date')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.status', 'Status in CRM')}
            </th>
          </tr>
        </thead>
        <tbody>
          {closuresQuery.isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.closures.loading', 'Loading…')}
              </td>
            </tr>
          ) : closuresQuery.isError ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#EF4444]">
                {t('pages.training.closures.loadFailed', 'Failed to load closures. Please retry.')}
              </td>
            </tr>
          ) : filteredRows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.closures.empty', 'No closures match the filters.')}
              </td>
            </tr>
          ) : (
            filteredRows.map((row, i) => (
              <ClosureRow
                key={`${row.client_id}-${row.payment_date}-${i}`}
                row={row}
                operatorName={
                  row.operator_name ??
                  (row.operator_id != null ? (operatorNameById.get(row.operator_id) ?? null) : null)
                }
                onOpenClient={() => navigate(`/dashboard/clients/${row.client_id}`)}
              />
            ))
          )}
        </tbody>
      </AnalyticsMockTable>

      {statusFilter === 'all' && total > pageSize ? (
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

function ClosureRow({
  row,
  operatorName,
  onOpenClient,
}: {
  row: ClosureItem
  operatorName: string | null
  onOpenClient: () => void
}) {
  const { t } = useTranslation('common')
  const displayName = operatorName ?? (row.operator_id ? `#${row.operator_id}` : '—')
  const initials = operatorName ? deriveInitials(operatorName) : ''
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>{formatDate(row.payment_date)}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          {initials ? (
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
              style={{ backgroundColor: avatarColorFor(row.operator_id) }}
            >
              {initials}
            </span>
          ) : null}
          <span className="text-xs font-medium text-[#05040D]">{displayName}</span>
        </div>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <button
          type="button"
          title={row.client_name ?? undefined}
          onClick={onOpenClient}
          className="text-[#3B82F6] hover:underline"
        >
          #{row.client_id}
        </button>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.contract_number ?? '—'}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-semibold text-[#05040D]`}>
        {formatAmount(row.amount)}
      </td>
      <td className={ANALYTICS_TABLE_TD}>{formatDate(row.payment_confirmation_date)}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          <Icons.Success size={10} />
          {t(`pages.training.closures.status.${row.status}`, row.status)}
        </span>
      </td>
    </tr>
  )
}

export default SuccessfulClosuresSubTab
