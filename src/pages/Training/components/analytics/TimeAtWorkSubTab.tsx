import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useScreenTime } from '@/features/operatorAnalytics/hooks/useScreenTime'
import type { ScreenTimeOperatorDto } from '@/features/operatorAnalytics/types'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Time at Work sub-tab (KAN-731 Block 3 — wired to /api/v1/analytics/screen-time).
 *
 * UI parity with the prior MockTimeAtWorkSubTab is preserved: 5-tile KPI strip,
 * sort pills (Downtime / To card / After call), Department dropdown, and a
 * 7-column operator table with red/green metric pills.
 */

type SortKey = 'downtime' | 'to_card' | 'after_call'

const SORT_OPTIONS: { id: SortKey; key: string; fallback: string }[] = [
  { id: 'downtime', key: 'pages.training.timeAtWork.sort.downtime', fallback: 'Downtime' },
  { id: 'to_card', key: 'pages.training.timeAtWork.sort.toCard', fallback: 'To card' },
  { id: 'after_call', key: 'pages.training.timeAtWork.sort.afterCall', fallback: 'After call' },
]

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

function avatarColorFor(operatorId: number): string {
  return AVATAR_PALETTE[Math.abs(operatorId) % AVATAR_PALETTE.length]
}

/** Format milliseconds as the mock's short label: `Xs` under a minute, else `Xmin Ys`. */
function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder === 0 ? `${minutes}min` : `${minutes}min ${remainder}s`
}

/** Idle/downtime renders in minutes (matches the mock "58 min" treatment). */
function formatMinutesMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min'
  const minutes = Math.max(1, Math.round(ms / 60_000))
  return `${minutes} min`
}

function mean(values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v) && v > 0)
  if (finite.length === 0) return 0
  return finite.reduce((sum, v) => sum + v, 0) / finite.length
}

function sumTabTimes(tabMs: Record<string, number> | undefined): number {
  if (!tabMs) return 0
  return Object.values(tabMs).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0)
}

interface OperatorRow {
  id: number
  operator: string
  initials: string
  avatarColor: string
  department: string
  calls: number
  timeToCardMs: number
  inclCreditsMs: number
  fillFormsMs: number
  downtimeMs: number
  afterCallMs: number
  highlight: 'red' | 'green' | null
}

function buildRows(
  data: ScreenTimeOperatorDto[] | undefined,
  operators: ReturnType<typeof useOperators>['data']
): OperatorRow[] {
  if (!data || !operators) return []
  const byId = new Map(operators.map((op) => [op.id, op] as const))
  return data.map((row) => {
    const operator = byId.get(row.operator_id)
    return {
      id: row.operator_id,
      operator: operator?.full_name ?? `#${row.operator_id}`,
      initials: deriveInitials(operator?.full_name ?? `#${row.operator_id}`),
      avatarColor: avatarColorFor(row.operator_id),
      department: operator?.department_name ?? '—',
      calls: row.sample_size,
      timeToCardMs: row.time_to_card_open_ms,
      inclCreditsMs: sumTabTimes(row.time_per_tab_ms),
      fillFormsMs: row.time_to_form_submit_ms,
      downtimeMs: row.idle_total_ms,
      afterCallMs: row.after_call_processing_ms,
      highlight: row.highlight ?? null,
    }
  })
}

/** Pill used for numeric metric cells. Tone defaults to neutral red; the
 * BE-supplied `highlight` overrides for the timeToCard metric (the only one
 * the screen-time benchmark currently classifies).
 */
function MetricPill({
  children,
  tone = 'red',
}: {
  children: React.ReactNode
  tone?: 'red' | 'green' | 'neutral'
}) {
  const palette =
    tone === 'green'
      ? 'bg-[#ECFDF5] text-[#047857]'
      : tone === 'neutral'
        ? 'bg-[#F3F4F6] text-[#374151]'
        : 'bg-[#FEF2F2] text-[#B91C1C]'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${palette}`}>
      {children}
    </span>
  )
}

export function TimeAtWorkSubTab() {
  const { t } = useTranslation('common')
  const [sortBy, setSortBy] = useState<SortKey>('downtime')
  const [department, setDepartment] = useState('all')

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null

  const { data: operators = [] } = useOperators(projectIdNum)

  // FE-side department narrowing — analytics-service screen-time endpoint
  // doesn't accept `department_ids` today (flagged as a KAN-731 follow-up).
  const filteredOperatorIds = useMemo<number[] | undefined>(() => {
    if (department === 'all') return undefined
    return operators
      .filter((op) => (op.department_name ?? '').toLowerCase() === department)
      .map((op) => op.id)
  }, [operators, department])

  const screenTimeQuery = useScreenTime(
    {
      period: 'today',
      operator_ids: filteredOperatorIds,
    },
    projectIdNum != null
  )

  const rows = useMemo<OperatorRow[]>(
    () => buildRows(screenTimeQuery.data?.operators, operators),
    [screenTimeQuery.data, operators]
  )

  const kpis = useMemo(
    () => ({
      toCardAvg: formatDurationMs(mean(rows.map((r) => r.timeToCardMs))),
      creditsAvg: formatDurationMs(mean(rows.map((r) => r.inclCreditsMs))),
      toFormAvg: formatDurationMs(mean(rows.map((r) => r.fillFormsMs))),
      downtimeAvg: formatMinutesMs(mean(rows.map((r) => r.downtimeMs))),
      afterCallAvg: formatDurationMs(mean(rows.map((r) => r.afterCallMs))),
    }),
    [rows]
  )

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      if (sortBy === 'downtime') return b.downtimeMs - a.downtimeMs
      if (sortBy === 'to_card') return b.timeToCardMs - a.timeToCardMs
      return b.afterCallMs - a.afterCallMs
    })
    return copy
  }, [rows, sortBy])

  const departmentOptions = useMemo<{ value: string; label: string }[]>(() => {
    const seen = new Map<string, string>()
    operators.forEach((op) => {
      if (op.department_name) seen.set(op.department_name.toLowerCase(), op.department_name)
    })
    return Array.from(seen, ([value, label]) => ({ value, label }))
  }, [operators])

  const isEmpty = !screenTimeQuery.isLoading && !screenTimeQuery.isError && rows.length === 0

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — 5 horizontal icon tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.toCard', 'To card (average)')}
          value={kpis.toCardAvg}
          icon={<Icons.FileImport size={18} />}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.credits', 'Credits (average)')}
          value={kpis.creditsAvg}
          icon={<Icons.Wallet01 size={18} />}
          iconBg="bg-[#ECFDF5]"
          iconTone="text-[#047857]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.toForm', 'To form (average)')}
          value={kpis.toFormAvg}
          icon={<Icons.File size={18} />}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.downtime', 'Downtime (average)')}
          value={kpis.downtimeAvg}
          icon={<Icons.Pause size={18} />}
          iconBg="bg-[#FEFCE8]"
          iconTone="text-[#CA8A04]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.afterCall', 'After call (avg.)')}
          value={kpis.afterCallAvg}
          icon={<Icons.Phone size={18} />}
          iconBg="bg-[#EFF6FF]"
          iconTone="text-[#3B82F6]"
        />
      </div>

      {/* Operators table card with header chrome */}
      <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-[#05040D]">
              {t('pages.training.timeAtWork.title', 'Time in work by operators')}
            </h3>
            <p className="text-[11px] text-[#676767]">
              {t(
                'pages.training.timeAtWork.subtitle',
                'Red = 30%+ above norm · Green = faster than norm'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.timeAtWork.sortBy', 'Sort by')}:
              </span>
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortBy === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#204E4D] text-white'
                        : 'border border-[#EBECE8] bg-white text-[#05040D] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    {t(opt.key, opt.fallback)}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.timeAtWork.department', 'Department')}
              </span>
              <div className="relative min-w-[180px]">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
                >
                  <option value="all">
                    {t('pages.training.timeAtWork.allDepartments', 'All departments')}
                  </option>
                  {departmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Icons.ArrowDown
                  size={12}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
                />
              </div>
            </div>
          </div>
        </div>

        <AnalyticsMockTable>
          <thead className={ANALYTICS_TABLE_HEAD}>
            <tr>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.timeAtWork.cols.operator', 'Operator')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.timeAtWork.cols.calls', 'Calls')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.timeAtWork.cols.timeToCard', 'Time to card')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.timeAtWork.cols.inclCredits', 'Incl. Credits')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.timeAtWork.cols.fillForms', 'Fill forms')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.timeAtWork.cols.downtimeShift', 'Downtime (shift)')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.timeAtWork.cols.afterCall', 'After call')}
              </th>
            </tr>
          </thead>
          <tbody>
            {screenTimeQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-[#676767]">
                  {t('pages.training.timeAtWork.loading', 'Loading…')}
                </td>
              </tr>
            ) : screenTimeQuery.isError ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-[#EF4444]">
                  {t(
                    'pages.training.timeAtWork.loadFailed',
                    'Failed to load screen-time data. Please retry.'
                  )}
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-[#676767]">
                  {t(
                    'pages.training.timeAtWork.empty',
                    'No screen-time activity in the selected window.'
                  )}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => <TimeAtWorkRow key={row.id} row={row} />)
            )}
          </tbody>
        </AnalyticsMockTable>
      </div>
    </div>
  )
}

function TimeAtWorkRow({ row }: { row: OperatorRow }) {
  // `highlight` covers the time_to_card_open_ms metric only (the one the
  // analytics-service benchmark currently classifies); other columns stay
  // at the neutral-red default.
  const cardTone = row.highlight ?? 'red'
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: row.avatarColor }}
          >
            {row.initials}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium text-[#05040D]">{row.operator}</span>
            <span className="text-[11px] text-[#676767]">{row.department}</span>
          </div>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} font-semibold text-[#05040D]`}>{row.calls}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill tone={cardTone}>{formatDurationMs(row.timeToCardMs)}</MetricPill>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill>{formatDurationMs(row.inclCreditsMs)}</MetricPill>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill>{formatDurationMs(row.fillFormsMs)}</MetricPill>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill>{formatMinutesMs(row.downtimeMs)}</MetricPill>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill>{formatDurationMs(row.afterCallMs)}</MetricPill>
      </td>
    </tr>
  )
}

export default TimeAtWorkSubTab
