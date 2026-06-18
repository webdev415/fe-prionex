import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { usePromisesAndCallbacks } from '@/features/training/hooks/usePromisesAndCallbacks'
import type {
  CallMonitoringPeriod,
  PromiseCallbackFilters,
  PromiseCallbackItem,
  PromiseCallbackStatus,
} from '@/features/training/types'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Promises and Callbacks sub-tab (KAN-733). Layout / UI styling mirror the
 * Figma frame verbatim (source of truth):
 *   1) 4 horizontal icon-tile KPIs (Total / Paid / Overdue / Pending)
 *   2) Dismissible overdue banner with secondary description
 *   3) Filter strip — radio period chips on the left, priority pill chips
 *      on the right (All / Critical / Average / Low with counts)
 *   4) Operator avatar + blue client link + red payment term for overdue
 *      rows + soft pink row tint for overdue rows
 *
 * Data is wired to /api/v1/interactions/promises-and-callbacks: the KPIs come
 * from the BE `summary_cards`, rows from `items`, and the per-row status is
 * derived server-side. The priority pill chips are kept per Figma; the BE has
 * no priority field yet (deferred — see KAN-733 plan §Discrepancy #2), so the
 * specific-priority chips auto-hide (count 0) until that data lands.
 */

type PeriodOption = 'today' | 'yesterday' | '7d' | '30d'

const PERIODS: { id: PeriodOption; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
]

// Maps the radio UI value to the BE `CallMonitoringPeriod` vocabulary.
const PERIOD_TO_BACKEND: Record<PeriodOption, CallMonitoringPeriod> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last_7d',
  '30d': 'last_30d',
}

type PromisePriority = 'critical' | 'average' | 'low'

const PRIORITY_OPTIONS: { id: PromisePriority | 'all'; key: string; fallback: string }[] = [
  { id: 'all', key: 'pages.training.promises.priority.all', fallback: 'All priorities' },
  { id: 'critical', key: 'pages.training.promises.priority.critical', fallback: 'Critical' },
  { id: 'average', key: 'pages.training.promises.priority.average', fallback: 'Average' },
  { id: 'low', key: 'pages.training.promises.priority.low', fallback: 'Low' },
]

const STATUS_TONE: Record<PromiseCallbackStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<PromiseCallbackStatus, { key: string; fallback: string }> = {
  pending: { key: 'pages.training.promises.status.pending', fallback: 'Pending' },
  paid: { key: 'pages.training.promises.status.paid', fallback: 'Paid' },
  overdue: { key: 'pages.training.promises.status.overdue', fallback: 'Overdue' },
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

function avatarColorFor(operatorId: number | null): string {
  if (operatorId == null) return '#EDEDED'
  return AVATAR_PALETTE[Math.abs(operatorId) % AVATAR_PALETTE.length]
}

function deriveInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mn}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function formatAmount(raw: string | null | undefined): string {
  if (raw == null) return '0'
  const n = Number(raw)
  if (!Number.isFinite(n)) return String(raw)
  return n.toLocaleString()
}

export function PromisesAndCallbacksSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [priorityFilter, setPriorityFilter] = useState<'all' | PromisePriority>('all')
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null

  const filters = useMemo<PromiseCallbackFilters>(
    () => ({
      period: PERIOD_TO_BACKEND[period],
      sort_by: 'date',
      sort_dir: 'desc',
      page: 1,
      page_size: 50,
    }),
    [period]
  )

  const query = usePromisesAndCallbacks(filters, projectIdNum != null)

  const cards = query.data?.summary_cards
  const items = query.data?.items ?? []
  const overdueCount = cards?.overdue_count ?? 0

  // The BE carries no priority field yet (KAN-733 plan §Discrepancy #2), so
  // only the "All priorities" chip renders (others count 0 → auto-hidden).
  const filteredRows = priorityFilter === 'all' ? items : []
  const priorityCount = (p: 'all' | PromisePriority): number => (p === 'all' ? items.length : 0)

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — 4 horizontal icon-tile KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsKpiTile
          label={t('pages.training.promises.kpi.total', 'Total promises')}
          value={`${formatAmount(cards?.total_promises_amount)} ₴`}
          icon={<span className="text-lg leading-none font-semibold">Σ</span>}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.promises.kpi.paid', 'Paid')}
          value={`${formatAmount(cards?.paid_amount)} ₴`}
          valueTone="text-emerald-600"
          icon={<Icons.Wallet01 size={18} />}
          iconBg="bg-[#ECFDF5]"
          iconTone="text-[#047857]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.promises.kpi.overdue', 'Overdue')}
          value={`${overdueCount} ${t('pages.training.promises.kpi.promisesUnit', 'promises')}`}
          valueTone="text-[#EF4444]"
          icon={<Icons.Warning size={18} />}
          iconBg="bg-[#FEF2F2]"
          iconTone="text-[#EF4444]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.promises.kpi.pending', 'Pending')}
          value={`${formatAmount(cards?.pending_amount)} ₴`}
          valueTone="text-amber-600"
          icon={<Icons.Clock01 size={18} />}
          iconBg="bg-[#FEFCE8]"
          iconTone="text-[#CA8A04]"
        />
      </div>

      {/* Overdue banner — dismissible, two-line copy (shown when overdue > 0) */}
      {overdueCount > 0 && !bannerDismissed ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
          <div className="align-center flex flex-row items-start gap-2.5">
            <Icons.Warning size={16} className="mt-0.5 flex-shrink-0 text-[#EF4444]" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-[#EF4444]">
                {t('pages.training.promises.overdueBanner', 'Overdue promises')}
              </span>
              <span className="text-[11px] text-[#676767]">
                {t('pages.training.promises.overdueBannerHint', {
                  count: overdueCount,
                  defaultValue:
                    '{{count}} promises did not pay on time. Please arrange a follow-up call as soon as possible.',
                })}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[#676767] hover:bg-[#FEE2E2] hover:text-[#EF4444]"
            aria-label={t('common.dismiss', 'Dismiss')}
          >
            <Icons.Close size={12} />
          </button>
        </div>
      ) : null}

      {/* Filter strip — radio periods on left, priority pills on right */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-medium tracking-[-0.02em] text-[#05040D]">
            {t('pages.training.period.label', 'Period')}:
          </span>
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

        {/* Priority pill chips */}
        <div className="flex flex-wrap items-center gap-2">
          {PRIORITY_OPTIONS.map((opt) => {
            const isActive = priorityFilter === opt.id
            const count = priorityCount(opt.id)
            if (opt.id !== 'all' && count === 0) return null
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPriorityFilter(opt.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#204E4D] text-white'
                    : 'border border-[#EBECE8] bg-white text-[#05040D] hover:bg-[#F7F7F7]'
                }`}
              >
                {t(opt.key, opt.fallback)}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.promises.cols.date', 'Date / Time')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.promises.cols.operator', 'Operator')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.promises.cols.client', 'Client')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.promises.cols.agreement', 'Agreement')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.promises.cols.amount', 'Amount')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.promises.cols.paymentTerm', 'Payment term')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.promises.cols.status', 'Status')}
            </th>
          </tr>
        </thead>
        <tbody>
          {query.isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.promises.loading', 'Loading…')}
              </td>
            </tr>
          ) : query.isError ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#EF4444]">
                {t('pages.training.promises.loadFailed', 'Failed to load. Please retry.')}
              </td>
            </tr>
          ) : filteredRows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.promises.empty', 'No promises or callbacks match the filters.')}
              </td>
            </tr>
          ) : (
            filteredRows.map((row) => <PromiseRow key={row.id} row={row} />)
          )}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function PromiseRow({ row }: { row: PromiseCallbackItem }) {
  const { t } = useTranslation('common')
  const isOverdue = row.status === 'overdue'
  const rowTint = isOverdue ? 'bg-[#FEF2F2]' : ''
  const operatorName = row.user_name ?? (row.user_id ? `#${row.user_id}` : '—')
  const initials = row.user_name ? deriveInitials(row.user_name) : ''
  const statusLabel = STATUS_LABEL[row.status]
  return (
    <tr className={`${ANALYTICS_TABLE_ROW} ${rowTint}`}>
      <td className={ANALYTICS_TABLE_TD}>{formatDateTime(row.interaction_date)}</td>
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
          <span className="text-xs font-medium text-[#05040D]">{operatorName}</span>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-[#3B82F6]`}>
        {row.client_full_name ?? `#${row.client_id}`}
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.contract_number ?? '—'}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-semibold text-[#05040D]`}>
        {row.promise_to_pay_amount != null ? `${formatAmount(row.promise_to_pay_amount)} ₴` : '—'}
      </td>
      <td className={`${ANALYTICS_TABLE_TD} ${isOverdue ? 'font-medium text-[#EF4444]' : ''}`}>
        {formatDate(row.payment_term_date)}
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[row.status]}`}
        >
          {t(statusLabel.key, statusLabel.fallback)}
        </span>
      </td>
    </tr>
  )
}

export default PromisesAndCallbacksSubTab
