import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { formatMonthDay, formatNumber, formatTimeShort } from '@/lib/localeFormat'
import { Pagination } from '@/components/ui/Pagination'
import { useAuthStore } from '@/stores/authStore'
import { useLeaks } from '@/features/training/hooks/useLeaks'
import { useExportLeaks } from '@/features/training/hooks/useExportLeaks'
import type {
  CallMonitoringPeriod,
  LeakFilters,
  LeakFollowUpStatusFilter,
  LeakItem,
} from '@/features/training/types'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'
import { withCurrency } from '@/lib/formatters'

/**
 * Leaks sub-tab (KAN-735). Layout / UI styling mirror the Figma frame verbatim
 * (the mock is the source of truth):
 *   1) Blue "escalation rule" info banner (dismissible) — this copy IS the
 *      escalation definition the BE implements (overdue, unfulfilled promise).
 *   2) 3 horizontal icon-tile KPIs (Total / Not followed up / Followed up)
 *   3) Red banner with title + secondary line (shown when not-followed-up > 0)
 *   4) Status chip strip (All / Not followed up / Followed up) attached to the
 *      leaks table card
 *   5) Table — operator avatar, blue client link, deal code, Follow-up pill,
 *      red "No call" or timestamped callback
 *
 * Data is wired to /api/v1/interactions/leaks: the KPIs come from the BE
 * `kpis`, rows from `items`, and the per-row `follow_up_status` is derived
 * server-side from whether a later call to the same client landed inside the
 * lookback window. Added on top of the mock frame (in the existing idiom): a
 * period selector, a lookback-days control, server-side pagination, row-click
 * navigation, and an Excel export — all required by the ticket.
 */

type LeakStatusFilter = LeakFollowUpStatusFilter

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

// KAN-735 Block 3 — hardcoded default until the project-level settings ticket.
const DEFAULT_LOOKBACK_DAYS = 5
const LOOKBACK_MIN = 1
const LOOKBACK_MAX = 90

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

function formatShortDate(iso: string | null, language: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return formatMonthDay(d, language)
}

function formatShortDateTime(iso: string | null, language: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${formatMonthDay(d, language)} ${formatTimeShort(d, language)}`
}

function formatAmount(raw: string | null | undefined, language: string): string {
  if (raw == null) return '—'
  const n = Number(raw)
  if (!Number.isFinite(n)) return String(raw)
  return formatNumber(n, language)
}

export function LeaksSubTab() {
  const { t, i18n } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<LeakStatusFilter>('all')
  const [period, setPeriod] = useState<PeriodOption>('7d')
  const [lookbackDays, setLookbackDays] = useState(DEFAULT_LOOKBACK_DAYS)
  const [infoDismissed, setInfoDismissed] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null

  // Any filter change invalidates the current page offset — reset to page 1.
  const changePeriod = (p: PeriodOption) => {
    setPeriod(p)
    setPage(1)
  }
  const changeStatus = (s: LeakStatusFilter) => {
    setStatusFilter(s)
    setPage(1)
  }
  const changeLookback = (next: number) => {
    setLookbackDays(Math.min(LOOKBACK_MAX, Math.max(LOOKBACK_MIN, next)))
    setPage(1)
  }

  const filters = useMemo<LeakFilters>(
    () => ({
      period: PERIOD_TO_BACKEND[period],
      lookback_days: lookbackDays,
      follow_up_status: statusFilter,
      sort_by: 'date',
      sort_dir: 'desc',
      page,
      page_size: pageSize,
    }),
    [period, lookbackDays, statusFilter, page, pageSize]
  )

  const query = useLeaks(filters, projectIdNum != null)
  const exportMutation = useExportLeaks()

  const kpis = query.data?.kpis
  const rows = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const totalCount = kpis?.total_escalations ?? 0
  const notFollowedCount = kpis?.not_followed_up ?? 0
  const followedCount = kpis?.followed_up ?? 0

  const STATUS_CHIPS: { id: LeakStatusFilter; label: string; count: number }[] = [
    { id: 'all', label: t('pages.training.leaks.chips.all', 'All'), count: totalCount },
    {
      id: 'not_followed_up',
      label: t('pages.training.leaks.chips.notFollowedUp', 'Not followed up'),
      count: notFollowedCount,
    },
    {
      id: 'followed_up',
      label: t('pages.training.leaks.chips.followedUp', 'Followed up'),
      count: followedCount,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Blue "escalation rule" info banner — dismissible */}
      {!infoDismissed ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Icons.Info size={16} className="mt-0.5 flex-shrink-0 text-[#3B82F6]" />
            <p className="text-[11px] leading-relaxed text-[#1D4ED8]">
              {t(
                'pages.training.leaks.ruleBanner',
                'Escalation rule: the client had a payment promise for today or overdue, but the payment has not been received. The operator is required to call back and follow up. Unprocessed escalations are a critical indicator.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInfoDismissed(true)}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[#1D4ED8] hover:bg-[#DBEAFE]"
            aria-label={t('common.dismiss', 'Dismiss')}
          >
            <Icons.Close size={12} />
          </button>
        </div>
      ) : null}

      {/* KPI strip — 3 horizontal icon tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.totalEscalations', 'Total escalations')}
          value={totalCount}
          icon={<Icons.Warning size={18} />}
          iconBg="bg-[#FEFCE8]"
          iconTone="text-[#CA8A04]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.notFollowedUp', 'Not followed up')}
          value={notFollowedCount}
          icon={<Icons.Close size={18} />}
          iconBg="bg-[#FEF2F2]"
          iconTone="text-[#EF4444]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.followedUp', 'Followed up')}
          value={followedCount}
          icon={<Icons.Success size={18} />}
          iconBg="bg-[#ECFDF5]"
          iconTone="text-[#22C55E]"
        />
      </div>

      {/* Red banner — title + secondary line (when there are unprocessed leaks) */}
      {notFollowedCount > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
          <Icons.Warning size={16} className="mt-0.5 flex-shrink-0 text-[#EF4444]" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-[#EF4444]">
              {t('pages.training.leaks.escalationBanner', {
                count: notFollowedCount,
                defaultValue: '{{count}} escalations without follow-up',
              })}
            </span>
            <span className="text-[11px] text-[#676767]">
              {t(
                'pages.training.leaks.escalationBannerHint',
                'Operators did not call after the escalation. Trainer or senior department intervention is needed.'
              )}
            </span>
          </div>
        </div>
      ) : null}

      {/* Filter strip — period radios on the left, lookback + export on the right */}
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Lookback-days control */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#676767]">
              {t('pages.training.leaks.lookback', 'Follow-up window')}:
            </span>
            <div className="flex items-center gap-1 rounded-full border border-[#EBECE8] bg-white px-1 py-0.5">
              <button
                type="button"
                onClick={() => changeLookback(lookbackDays - 1)}
                disabled={lookbackDays <= LOOKBACK_MIN}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[#545454] hover:bg-[#F7F7F7] disabled:opacity-40"
                aria-label={t('pages.training.leaks.lookbackDecrease', 'Decrease window')}
              >
                −
              </button>
              <span className="min-w-[2.5rem] text-center text-xs font-semibold text-[#05040D]">
                {t('pages.training.leaks.lookbackValue', {
                  count: lookbackDays,
                  defaultValue: '{{count}} d',
                })}
              </span>
              <button
                type="button"
                onClick={() => changeLookback(lookbackDays + 1)}
                disabled={lookbackDays >= LOOKBACK_MAX}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[#545454] hover:bg-[#F7F7F7] disabled:opacity-40"
                aria-label={t('pages.training.leaks.lookbackIncrease', 'Increase window')}
              >
                +
              </button>
            </div>
          </div>

          {/* Excel export */}
          <button
            type="button"
            onClick={() => exportMutation.mutate(filters)}
            disabled={exportMutation.isPending || total === 0}
            className="flex items-center gap-1.5 rounded-full border border-[#EBECE8] bg-white px-3 py-1.5 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7] disabled:opacity-50"
          >
            <Icons.Download size={14} />
            {exportMutation.isPending
              ? t('pages.training.leaks.exporting', 'Exporting…')
              : t('pages.training.leaks.export', 'Export')}
          </button>
        </div>
      </div>

      {/* Status chip strip + table together in one card */}
      <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EBECE8] px-4 py-3">
          {STATUS_CHIPS.map((chip) => {
            const isActive = statusFilter === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => changeStatus(chip.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'text-[#545454] hover:bg-[#F7F7F7]'
                }`}
              >
                {chip.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            )
          })}
        </div>

        <AnalyticsMockTable>
          <thead className={ANALYTICS_TABLE_HEAD}>
            <tr>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.operator', 'Operator')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.client', 'Client')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.agreement', 'Agreement')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.amount', 'Amount of promise')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.dateOfPromise', 'Date of promise')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.followUp', 'Follow-up')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.callAfter', 'Call after escalation')}
              </th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                  {t('pages.training.leaks.loading', 'Loading…')}
                </td>
              </tr>
            ) : query.isError ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#EF4444]">
                  {t('pages.training.leaks.loadFailed', 'Failed to load. Please retry.')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                  {t('pages.training.leaks.empty', 'No escalations match the filters.')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <LeakRow
                  key={row.id}
                  row={row}
                  language={i18n.language}
                  followedLabel={t('pages.training.leaks.followUp.followed', 'Followed up')}
                  notFollowedLabel={t(
                    'pages.training.leaks.followUp.notFollowed',
                    'Not followed up'
                  )}
                  noCallLabel={t('pages.training.leaks.noCall', 'No call')}
                />
              ))
            )}
          </tbody>
        </AnalyticsMockTable>
      </div>

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

function LeakRow({
  row,
  language,
  followedLabel,
  notFollowedLabel,
  noCallLabel,
}: {
  row: LeakItem
  language: string
  followedLabel: string
  notFollowedLabel: string
  noCallLabel: string
}) {
  const navigate = useNavigate()
  const isFollowed = row.follow_up_status === 'followed_up'
  const operatorName = row.operator_name ?? (row.operator_id ? `#${row.operator_id}` : '—')
  const initials = row.operator_name ? deriveInitials(row.operator_name) : ''
  const callAfter = formatShortDateTime(row.last_call_after_escalation_at, language)
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          {initials ? (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
              style={{ backgroundColor: avatarColorFor(row.operator_id) }}
            >
              {initials}
            </span>
          ) : null}
          <span className="text-xs font-medium text-[#05040D]">{operatorName}</span>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-[#3B82F6]`}>
        <button
          type="button"
          title={row.client_full_name ?? undefined}
          onClick={() => navigate(`/dashboard/clients/${row.client_id}`)}
          className="hover:underline"
        >
          #{row.client_id}
        </button>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.contract_number ?? '—'}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-semibold text-[#05040D]`}>
        {row.promise_amount != null
          ? withCurrency(formatAmount(row.promise_amount, language), 'suffix')
          : '—'}
      </td>
      <td className={ANALYTICS_TABLE_TD}>{formatShortDate(row.promise_date, language)}</td>
      <td className={ANALYTICS_TABLE_TD}>
        {isFollowed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Icons.Success size={10} />
            {followedLabel}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
            <Icons.Close size={10} />
            {notFollowedLabel}
          </span>
        )}
      </td>
      <td
        className={`${ANALYTICS_TABLE_TD} ${callAfter ? 'text-[#05040D]' : 'font-medium text-[#EF4444]'}`}
      >
        {callAfter ?? noCallLabel}
      </td>
    </tr>
  )
}

export default LeaksSubTab
