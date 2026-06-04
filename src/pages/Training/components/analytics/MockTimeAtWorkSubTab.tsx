import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_TIME_AT_WORK,
  MOCK_TIME_AT_WORK_KPIS,
  type MockTimeAtWorkRow,
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
 * Time at Work sub-tab (KAN-415). Mirrors the Figma frame:
 *   1) 5 horizontal icon-tile KPIs (To card / Credits / To form / Downtime
 *      / After call).
 *   2) Section card header: "Time in work by operators" + subtitle
 *      "Red = 30%+ above norm · Green = faster than norm", with sort-by
 *      pill chips and Department dropdown on the right.
 *   3) Table — operator avatar + name + department sub-label; numeric
 *      values rendered as red pills (above norm).
 */

type SortKey = 'downtime' | 'to_card' | 'after_call'

const SORT_OPTIONS: { id: SortKey; key: string; fallback: string }[] = [
  { id: 'downtime', key: 'pages.training.timeAtWork.sort.downtime', fallback: 'Downtime' },
  { id: 'to_card', key: 'pages.training.timeAtWork.sort.toCard', fallback: 'To card' },
  { id: 'after_call', key: 'pages.training.timeAtWork.sort.afterCall', fallback: 'After call' },
]

const ALL_DEPARTMENTS = Array.from(new Set(MOCK_TIME_AT_WORK.map((r) => r.department))).sort()

/** Pill used for numeric metric cells (Time to card, Incl. Credits, etc.). */
function MetricPill({ children, tone = 'red' }: { children: React.ReactNode; tone?: 'red' | 'green' }) {
  const palette =
    tone === 'green'
      ? 'bg-[#ECFDF5] text-[#047857]'
      : 'bg-[#FEF2F2] text-[#B91C1C]'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${palette}`}>
      {children}
    </span>
  )
}

export function MockTimeAtWorkSubTab() {
  const { t } = useTranslation('common')
  const [sortBy, setSortBy] = useState<SortKey>('downtime')
  const [department, setDepartment] = useState('all')
  const k = MOCK_TIME_AT_WORK_KPIS

  const rows = MOCK_TIME_AT_WORK.filter((r) =>
    department === 'all' ? true : r.department === department
  ).sort((a, b) => {
    if (sortBy === 'downtime') return parseInt(b.downtimeShift) - parseInt(a.downtimeShift)
    if (sortBy === 'to_card') return parseInt(b.timeToCard) - parseInt(a.timeToCard)
    return parseInt(b.afterCall) - parseInt(a.afterCall)
  })

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — 5 horizontal icon tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.toCard', 'To card (average)')}
          value={k.toCardAvg}
          icon={<Icons.FileImport size={18} />}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.credits', 'Credits (average)')}
          value={k.creditsAvg}
          icon={<Icons.Wallet01 size={18} />}
          iconBg="bg-[#ECFDF5]"
          iconTone="text-[#047857]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.toForm', 'To form (average)')}
          value={k.toFormAvg}
          icon={<Icons.File size={18} />}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.downtime', 'Downtime (average)')}
          value={k.downtimeAvg}
          icon={<Icons.Pause size={18} />}
          iconBg="bg-[#FEFCE8]"
          iconTone="text-[#CA8A04]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.timeAtWork.kpi.afterCall', 'After call (avg.)')}
          value={k.afterCallAvg}
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
                  {ALL_DEPARTMENTS.map((d) => (
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
            {rows.map((row) => (
              <TimeAtWorkRow key={row.id} row={row} />
            ))}
          </tbody>
        </AnalyticsMockTable>
      </div>
    </div>
  )
}

function TimeAtWorkRow({ row }: { row: MockTimeAtWorkRow }) {
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
        <MetricPill>{row.timeToCard}</MetricPill>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill>{row.inclCredits}</MetricPill>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill>{row.fillForms}</MetricPill>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill>{row.downtimeShift}</MetricPill>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <MetricPill>{row.afterCall}</MetricPill>
      </td>
    </tr>
  )
}

export default MockTimeAtWorkSubTab
