import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_PROMISES,
  MOCK_PROMISES_KPIS,
  type MockPromiseRow,
  type PromisePriority,
  type PromiseStatus,
} from '../../mocks/trainerWorkplaceMocks'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Promises and Callbacks sub-tab (KAN-415). Mirrors the Figma frame:
 *   1) 4 horizontal icon-tile KPIs (Total / Paid / Overdue / Pending)
 *   2) Dismissible overdue banner with secondary description
 *   3) Filter strip — radio period chips on the left, priority pill chips
 *      on the right (All / Critical / Average / Low with counts)
 *   4) Operator avatar + blue client link + red payment term for overdue
 *      rows + soft pink row tint for overdue rows
 */

type PeriodOption = 'today' | 'yesterday' | '7d' | '30d'

const PERIODS: { id: PeriodOption; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
]

const PRIORITY_OPTIONS: { id: PromisePriority | 'all'; key: string; fallback: string }[] = [
  { id: 'all', key: 'pages.training.promises.priority.all', fallback: 'All priorities' },
  { id: 'critical', key: 'pages.training.promises.priority.critical', fallback: 'Critical' },
  { id: 'average', key: 'pages.training.promises.priority.average', fallback: 'Average' },
  { id: 'low', key: 'pages.training.promises.priority.low', fallback: 'Low' },
]

const STATUS_TONE: Record<PromiseStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  expected: 'bg-blue-100 text-blue-700',
}

const STATUS_LABEL: Record<PromiseStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  overdue: 'Overdue',
  expected: 'Expected',
}

export function PromisesAndCallbacksSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [priorityFilter, setPriorityFilter] = useState<'all' | PromisePriority>('all')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const k = MOCK_PROMISES_KPIS

  const filteredRows = MOCK_PROMISES.filter(
    (r) => priorityFilter === 'all' || r.priority === priorityFilter
  )

  const priorityCount = (p: 'all' | PromisePriority): number =>
    p === 'all' ? MOCK_PROMISES.length : MOCK_PROMISES.filter((r) => r.priority === p).length

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — 4 horizontal icon-tile KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsKpiTile
          label={t('pages.training.promises.kpi.total', 'Total promises')}
          value={`${k.total.amount.toLocaleString()} ${k.total.currency}`}
          icon={<span className="text-lg leading-none font-semibold">Σ</span>}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.promises.kpi.paid', 'Paid')}
          value={`${k.paid.amount.toLocaleString()} ${k.paid.currency}`}
          valueTone="text-emerald-600"
          icon={<Icons.Wallet01 size={18} />}
          iconBg="bg-[#ECFDF5]"
          iconTone="text-[#047857]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.promises.kpi.overdue', 'Overdue')}
          value={`${k.overdue.count} ${t('pages.training.promises.kpi.promisesUnit', 'promises')}`}
          valueTone="text-[#EF4444]"
          icon={<Icons.Warning size={18} />}
          iconBg="bg-[#FEF2F2]"
          iconTone="text-[#EF4444]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.promises.kpi.pending', 'Pending')}
          value={`${k.pending.count.toLocaleString()} ${t('pages.training.promises.kpi.promisesUnit', 'promises')}`}
          valueTone="text-amber-600"
          icon={<Icons.Clock01 size={18} />}
          iconBg="bg-[#FEFCE8]"
          iconTone="text-[#CA8A04]"
        />
      </div>

      {/* Overdue banner — dismissible, two-line copy */}
      {!bannerDismissed ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Icons.Warning size={16} className="mt-0.5 flex-shrink-0 text-[#EF4444]" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-[#EF4444]">
                {t('pages.training.promises.overdueBanner', 'Overdue promises')}
              </span>
              <span className="text-[11px] text-[#676767]">
                {t(
                  'pages.training.promises.overdueBannerHint',
                  '2 clients did not pay on time. Please arrange a follow-up call as soon as possible.'
                )}
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
          {filteredRows.map((row) => (
            <PromiseRow key={row.id} row={row} />
          ))}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function PromiseRow({ row }: { row: MockPromiseRow }) {
  const isOverdue = row.status === 'overdue'
  const rowTint = isOverdue ? 'bg-[#FEF2F2]' : ''
  return (
    <tr className={`${ANALYTICS_TABLE_ROW} ${rowTint}`}>
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
      <td className={`${ANALYTICS_TABLE_TD} text-[#3B82F6]`}>{row.client}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.agreement}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-semibold text-[#05040D]`}>
        {row.amount.toLocaleString()} ₴
      </td>
      <td className={`${ANALYTICS_TABLE_TD} ${isOverdue ? 'font-medium text-[#EF4444]' : ''}`}>
        {row.paymentDateLabel}
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[row.status]}`}
        >
          {STATUS_LABEL[row.status]}
        </span>
      </td>
    </tr>
  )
}

export default PromisesAndCallbacksSubTab
