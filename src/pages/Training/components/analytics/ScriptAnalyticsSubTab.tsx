import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useScriptAnalytics } from '@/features/operatorAnalytics/hooks/useScriptAnalytics'
import type {
  ScriptAnalyticsFlagDto,
  ScriptAnalyticsOperatorDto,
  ScriptAnalyticsResponse,
} from '@/features/operatorAnalytics/types'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Script Analytics sub-tab (KAN-731 Block 4 — wired to /api/v1/analytics/script-analytics).
 *
 * UI parity with the prior ScriptAnalyticsRedesignSubTab is preserved: a
 * collapsible auto-flags card up top, a per-operator result-distribution
 * table with mini-bar pills, and a coach context footer banner.
 */

type AlertSeverity = 'info' | 'warn' | 'critical'

const SEVERITY_PILL: Record<AlertSeverity, string> = {
  info: 'bg-[#EFF6FF] text-[#1D4ED8]',
  warn: 'bg-[#FEF9C3] text-[#A16207]',
  critical: 'bg-[#FEF2F2] text-[#B91C1C]',
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

// Auto-flag rule labels + severity. The `rule` field on
// ScriptAnalyticsFlagDto matches the keys analytics-service emits today
// (no_answer_streak / fast_result / missing_payment_promise / distribution_drift).
const RULE_META: Record<
  string,
  { labelKey: string; labelFallback: string; severity: AlertSeverity }
> = {
  no_answer_streak: {
    labelKey: 'pages.training.script.alerts.rules.noAnswerStreak',
    labelFallback: 'Series of missed calls',
    severity: 'critical',
  },
  fast_result: {
    labelKey: 'pages.training.script.alerts.rules.fastResult',
    labelFallback: 'Quick result (< 10s)',
    severity: 'warn',
  },
  missing_payment_promise: {
    labelKey: 'pages.training.script.alerts.rules.missingPromise',
    labelFallback: 'No recent payment promise',
    severity: 'warn',
  },
  distribution_drift: {
    labelKey: 'pages.training.script.alerts.rules.distributionDrift',
    labelFallback: 'Distribution drift vs team',
    severity: 'info',
  },
}

// Distribution column matchers — substring keywords (case-insensitive) used
// to bucket the BE's free-form `result_name` keys into the four fixed UI
// columns. Matches multi-language seed values (en/uk/ru).
const COLUMN_KEYWORDS = {
  promises: ['promise', 'обіцянк', 'обещание', 'pay'],
  refusals: ['refus', 'відмов', 'отказ'],
  missedCalls: ['missed', 'no answer', 'no_answer', 'пропущ', 'без відпов', 'без ответа'],
  willPass: ['will pass', 'will_pass', 'передаст', 'передасть'],
} as const

type ColumnKey = keyof typeof COLUMN_KEYWORDS

function deriveInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function avatarColorFor(operatorId: number): string {
  return AVATAR_PALETTE[Math.abs(operatorId) % AVATAR_PALETTE.length]
}

function bucketDistribution(
  distribution: Record<string, number>
): Record<ColumnKey, number> {
  const result: Record<ColumnKey, number> = {
    promises: 0,
    refusals: 0,
    missedCalls: 0,
    willPass: 0,
  }
  for (const [name, count] of Object.entries(distribution)) {
    const lower = name.toLowerCase()
    for (const col of Object.keys(COLUMN_KEYWORDS) as ColumnKey[]) {
      if (COLUMN_KEYWORDS[col].some((kw) => lower.includes(kw))) {
        result[col] += count
        break
      }
    }
  }
  return result
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mn}`
}

interface UiAlert {
  id: string
  category: string
  severity: AlertSeverity
  operator: string
  operatorInitials: string
  operatorAvatarColor: string
  description: string
  dateLabel: string
}

interface UiDistributionRow {
  id: number
  operator: string
  initials: string
  avatarColor: string
  department: string
  total: number
  buckets: Record<ColumnKey, number>
  bucketsPct: Record<ColumnKey, number>
  flags: number
}

interface BuildResult {
  alerts: UiAlert[]
  rows: UiDistributionRow[]
}

function buildDerivedData(
  data: ScriptAnalyticsResponse | undefined,
  operators: ReturnType<typeof useOperators>['data'],
  t: ReturnType<typeof useTranslation>['t']
): BuildResult {
  if (!data) return { alerts: [], rows: [] }
  const byId = new Map((operators ?? []).map((op) => [op.id, op] as const))

  const flagsByOperator = new Map<number, number>()
  data.flags.forEach((f) => {
    flagsByOperator.set(f.operator_id, (flagsByOperator.get(f.operator_id) ?? 0) + 1)
  })

  const rows: UiDistributionRow[] = data.operators.map((op: ScriptAnalyticsOperatorDto) => {
    const operator = byId.get(op.operator_id)
    const operatorName = operator?.full_name ?? `#${op.operator_id}`
    const buckets = bucketDistribution(op.distribution)
    return {
      id: op.operator_id,
      operator: operatorName,
      initials: deriveInitials(operatorName),
      avatarColor: avatarColorFor(op.operator_id),
      department: operator?.department_name ?? '—',
      total: op.total_interactions,
      buckets,
      bucketsPct: {
        promises: pct(buckets.promises, op.total_interactions),
        refusals: pct(buckets.refusals, op.total_interactions),
        missedCalls: pct(buckets.missedCalls, op.total_interactions),
        willPass: pct(buckets.willPass, op.total_interactions),
      },
      flags: flagsByOperator.get(op.operator_id) ?? 0,
    }
  })

  const alerts: UiAlert[] = data.flags.map((flag: ScriptAnalyticsFlagDto, idx) => {
    const operator = byId.get(flag.operator_id)
    const operatorName = operator?.full_name ?? `#${flag.operator_id}`
    const meta = RULE_META[flag.rule]
    const category = meta
      ? t(meta.labelKey, meta.labelFallback)
      : flag.rule.replace(/_/g, ' ')
    const severity: AlertSeverity = meta?.severity ?? 'warn'
    const description =
      flag.detail ??
      t('pages.training.script.alerts.defaultDescription', {
        defaultValue: '{{rule}} · value {{value}} exceeded threshold {{threshold}}',
        rule: flag.rule,
        value: flag.value,
        threshold: flag.threshold,
      })
    return {
      id: `${flag.operator_id}-${flag.rule}-${idx}`,
      category,
      severity,
      operator: operatorName,
      operatorInitials: deriveInitials(operatorName),
      operatorAvatarColor: avatarColorFor(flag.operator_id),
      description,
      dateLabel: formatDateLabel(flag.triggered_at),
    }
  })

  return { alerts, rows }
}

/** Inline flag SVG — preserves the visual from the prior implementation. */
function FlagIcon({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M3 2v12M3 3h8l-1.5 2.5L11 8H3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ScriptAnalyticsSubTab() {
  const { t } = useTranslation('common')
  const [flagsOpen, setFlagsOpen] = useState(true)
  const [department, setDepartment] = useState('all')

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const trainerName = useAuthStore((s) => s.user?.full_name ?? null)

  const { data: operators = [] } = useOperators(projectIdNum)

  // FE-side department narrowing — analytics-service script-analytics doesn't
  // yet accept `department_ids` (flagged as a KAN-731 follow-up).
  const filteredOperatorIds = useMemo<number[] | undefined>(() => {
    if (department === 'all') return undefined
    return operators
      .filter((op) => (op.department_name ?? '').toLowerCase() === department)
      .map((op) => op.id)
  }, [operators, department])

  const scriptQuery = useScriptAnalytics(
    {
      period: 'today',
      operator_ids: filteredOperatorIds,
    },
    projectIdNum != null
  )

  const { alerts, rows } = useMemo(
    () => buildDerivedData(scriptQuery.data, operators, t),
    [scriptQuery.data, operators, t]
  )

  const departmentOptions = useMemo<{ value: string; label: string }[]>(() => {
    const seen = new Map<string, string>()
    operators.forEach((op) => {
      if (op.department_name) seen.set(op.department_name.toLowerCase(), op.department_name)
    })
    return Array.from(seen, ([value, label]) => ({ value, label }))
  }, [operators])

  const visibleRows = useMemo(() => {
    if (department === 'all') return rows
    return rows.filter((r) => r.department.toLowerCase() === department)
  }, [rows, department])

  return (
    <div className="flex flex-col gap-4">
      {/* Auto-flag alerts — collapsible card */}
      <div className="rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={() => setFlagsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Icons.Warning size={16} className="text-[#EF4444]" />
            <h3 className="text-sm font-semibold text-[#05040D]">
              {t('pages.training.script.alerts.title', 'Automatic flags - require attention')}
            </h3>
            <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-semibold text-[#B91C1C]">
              {alerts.length}
            </span>
          </div>
          {flagsOpen ? (
            <Icons.ArrowUp size={14} className="text-[#676767]" />
          ) : (
            <Icons.ArrowDown size={14} className="text-[#676767]" />
          )}
        </button>

        {flagsOpen ? (
          alerts.length === 0 ? (
            <p className="border-t border-[#EBECE8] px-4 py-3 text-[11px] text-[#676767]">
              {t('pages.training.script.alerts.empty', 'No auto-flags in the selected window.')}
            </p>
          ) : (
            <ul className="divide-y divide-[#F3F4F6] border-t border-[#EBECE8]">
              {alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </ul>
          )
        ) : null}
      </div>

      {/* Result distribution by operators */}
      <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-[#05040D]">
              {t(
                'pages.training.script.distribution.title',
                'Distribution of results by operators'
              )}
            </h3>
            <p className="text-[11px] text-[#676767]">
              {t('pages.training.script.distribution.subtitle', 'Comparison with team norm')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.script.distribution.department', 'Department')}
            </span>
            <div className="relative min-w-[180px]">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
              >
                <option value="all">
                  {t('pages.training.script.distribution.allDepts', 'All departments')}
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

        <AnalyticsMockTable>
          <thead className={ANALYTICS_TABLE_HEAD}>
            <tr>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.script.distribution.cols.operator', 'Operator')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.script.distribution.cols.total', 'Total')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.script.distribution.cols.promises', 'Promises')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.script.distribution.cols.refusals', 'Refusals')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.script.distribution.cols.missedCalls', 'Missed calls')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.script.distribution.cols.willPass', 'Will pass')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.script.distribution.cols.flags', 'Flags')}
              </th>
            </tr>
          </thead>
          <tbody>
            {scriptQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-[#676767]">
                  {t('pages.training.script.distribution.loading', 'Loading…')}
                </td>
              </tr>
            ) : scriptQuery.isError ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-[#EF4444]">
                  {t(
                    'pages.training.script.distribution.loadFailed',
                    'Failed to load script analytics.'
                  )}
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-[#676767]">
                  {t(
                    'pages.training.script.distribution.empty',
                    'No interaction activity in the selected window.'
                  )}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => <DistributionRow key={row.id} row={row} />)
            )}
          </tbody>
        </AnalyticsMockTable>
      </div>
    </div>
  )
}

function AlertRow({ alert }: { alert: UiAlert }) {
  const { t } = useTranslation('common')
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA]">
      <span
        className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${SEVERITY_PILL[alert.severity]}`}
      >
        {alert.category}
      </span>
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
          style={{ backgroundColor: alert.operatorAvatarColor }}
        >
          {alert.operatorInitials}
        </span>
        <span className="text-xs font-medium text-[#05040D]">{alert.operator}</span>
      </div>
      <span className="flex-1 text-[11px] text-[#676767]">{alert.description}</span>
      <span className="text-[11px] text-[#9CA3AF]">{alert.dateLabel}</span>
      <button
        type="button"
        className="flex h-7 items-center gap-1 rounded-md border border-[#EBECE8] bg-white px-2.5 text-[11px] font-medium text-[#05040D] hover:bg-[#F7F7F7]"
      >
        <Icons.View size={12} />
        {t('pages.training.script.alerts.view', 'View')}
      </button>
      <button
        type="button"
        className="flex h-7 items-center gap-1 rounded-md border border-[#EBECE8] bg-white px-2.5 text-[11px] font-medium text-[#05040D] hover:bg-[#F7F7F7]"
      >
        <Icons.Close size={12} />
        {t('pages.training.script.alerts.close', 'Close')}
      </button>
    </li>
  )
}

function MetricBar({ count, pct, barColor }: { count: number; pct: number; barColor: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-[#F3F4F6]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
        />
      </span>
      <span className="text-xs font-medium text-[#05040D]">{count}</span>
      <span className="text-[10px] text-[#9CA3AF]">{pct}%</span>
    </div>
  )
}

function DistributionRow({ row }: { row: UiDistributionRow }) {
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: row.avatarColor }}
          >
            {row.initials}
          </div>
          <span className="text-xs font-medium text-[#05040D]">{row.operator}</span>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} font-semibold text-[#05040D]`}>{row.total}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricBar count={row.buckets.promises} pct={row.bucketsPct.promises} barColor="#22C55E" />
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricBar count={row.buckets.refusals} pct={row.bucketsPct.refusals} barColor="#EF4444" />
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricBar
          count={row.buckets.missedCalls}
          pct={row.bucketsPct.missedCalls}
          barColor="#F59E0B"
        />
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricBar count={row.buckets.willPass} pct={row.bucketsPct.willPass} barColor="#3B82F6" />
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-medium text-[#B91C1C]">
          <FlagIcon size={10} />
          {row.flags} flag
        </span>
      </td>
    </tr>
  )
}

export default ScriptAnalyticsSubTab
