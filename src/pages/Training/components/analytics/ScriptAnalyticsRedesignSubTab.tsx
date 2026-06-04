import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_COACH_CONTEXT,
  MOCK_SCRIPT_ALERTS,
  MOCK_SCRIPT_DISTRIBUTION,
  type MockScriptAlert,
  type MockScriptDistribution,
} from '../../mocks/trainerWorkplaceMocks'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Script Analytics sub-tab (KAN-503). Mirrors the Figma frame:
 *   1) Collapsible "Automatic flags – require attention" card with a count
 *      badge. Each row: category pill (colored by severity) + avatar + name
 *      + description + date + View / Close buttons.
 *   2) "Distribution of results by operators" card with department dropdown.
 *      Each metric column renders a colored mini-bar + count + percentage;
 *      Flags column shows a red "N flag" pill.
 *   3) Coach context footer banner — Coach's Workspace, region/product,
 *      current assignment, operators-in-operation count.
 */

const SEVERITY_PILL: Record<MockScriptAlert['severity'], string> = {
  info: 'bg-[#EFF6FF] text-[#1D4ED8]',
  warn: 'bg-[#FEF9C3] text-[#A16207]',
  critical: 'bg-[#FEF2F2] text-[#B91C1C]',
}

/** Inline flag SVG — no Flag icon in the Icons module. */
function FlagIcon({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden
    >
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

export function ScriptAnalyticsRedesignSubTab() {
  const { t } = useTranslation('common')
  const [flagsOpen, setFlagsOpen] = useState(true)
  const [department, setDepartment] = useState('all')

  const departments = Array.from(new Set(MOCK_SCRIPT_DISTRIBUTION.map((r) => r.department))).sort()
  const rows = MOCK_SCRIPT_DISTRIBUTION.filter((r) =>
    department === 'all' ? true : r.department === department
  )

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
              {MOCK_SCRIPT_ALERTS.length}
            </span>
          </div>
          {flagsOpen ? (
            <Icons.ArrowUp size={14} className="text-[#676767]" />
          ) : (
            <Icons.ArrowDown size={14} className="text-[#676767]" />
          )}
        </button>

        {flagsOpen ? (
          <ul className="divide-y divide-[#F3F4F6] border-t border-[#EBECE8]">
            {MOCK_SCRIPT_ALERTS.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
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
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
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
            {rows.map((row) => (
              <DistributionRow key={row.id} row={row} />
            ))}
          </tbody>
        </AnalyticsMockTable>
      </div>

      {/* Coach context footer banner */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <span className="rounded-full bg-[#F7F7F7] px-3 py-1 text-[11px] font-semibold text-[#05040D]">
          {t('pages.training.script.coach.badge', 'Coach')}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#05040D]">
          <Icons.User size={14} className="text-[#676767]" />
          {MOCK_COACH_CONTEXT.title}
          <span className="text-[#9CA3AF]">·</span>
          {MOCK_COACH_CONTEXT.region}
          <span className="text-[#9CA3AF]">·</span>
          {MOCK_COACH_CONTEXT.product}
        </div>
        <span className="text-[11px] text-[#676767]">{MOCK_COACH_CONTEXT.assignmentText}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-[#676767]">
          <span className="rounded-full bg-[#F7F7F7] px-2 py-0.5 font-medium text-[#05040D]">
            {MOCK_COACH_CONTEXT.operatorsInOperation}
          </span>
          {t('pages.training.script.coach.operatorsInOperation', 'operators in operation')}
        </span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#BBFB5B] text-[#05040D]"
          aria-label="Open coach panel"
        >
          <Icons.ArrowUp size={14} />
        </button>
      </div>
    </div>
  )
}

function AlertRow({ alert }: { alert: MockScriptAlert }) {
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

function DistributionRow({ row }: { row: MockScriptDistribution }) {
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
        <MetricBar count={row.promises} pct={row.promisesPct} barColor="#22C55E" />
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricBar count={row.refusals} pct={row.refusalsPct} barColor="#EF4444" />
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricBar count={row.missedCalls} pct={row.missedCallsPct} barColor="#F59E0B" />
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricBar count={row.willPass} pct={row.willPassPct} barColor="#3B82F6" />
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

export default ScriptAnalyticsRedesignSubTab
