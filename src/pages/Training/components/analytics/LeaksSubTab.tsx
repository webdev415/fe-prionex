import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_LEAKS, MOCK_LEAKS_KPIS, type MockLeakRow } from '../../mocks/trainerWorkplaceMocks'
import { PeriodFilterStrip, type PeriodOption } from './PeriodFilterStrip'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Leaks sub-tab (KAN-415). Escalations / lost-client view — KPI strip +
 * follow-up filter chips + table.
 */
export function LeaksSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [followUpFilter, setFollowUpFilter] = useState<'all' | 'not' | 'done'>('all')
  const k = MOCK_LEAKS_KPIS

  const rows = MOCK_LEAKS.filter((row) => {
    if (followUpFilter === 'not') return !row.followedUp
    if (followUpFilter === 'done') return row.followedUp
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <PeriodFilterStrip
        value={period}
        onChange={setPeriod}
        extraChips={[
          {
            id: 'all',
            label: 'All',
            active: followUpFilter === 'all',
            onClick: () => setFollowUpFilter('all'),
          },
          {
            id: 'not',
            label: 'Not followed up',
            active: followUpFilter === 'not',
            onClick: () => setFollowUpFilter('not'),
          },
          {
            id: 'done',
            label: 'Followed up',
            active: followUpFilter === 'done',
            onClick: () => setFollowUpFilter('done'),
          },
        ]}
      />

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-[11px] text-emerald-700">
        {t(
          'pages.training.leaks.healthBanner',
          'Escalation rate sits within healthy bounds for the current period.'
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.totalEscalations', 'Total escalations')}
          value={k.totalEscalations}
        />
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.notFollowedUp', 'Not followed up')}
          value={k.notFollowedUp}
          valueTone="text-red-600"
          accentColor="bg-[#EF4444]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.followedUp', 'Followed up')}
          value={k.followedUp}
          valueTone="text-emerald-600"
          accentColor="bg-[#22C55E]"
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-red-700">
          <Icons.Warning size={14} />
          {t(
            'pages.training.leaks.escalationBanner',
            'Escalations without follow-up — take action'
          )}
        </div>
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
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
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
          {rows.map((row) => (
            <LeakRow key={row.id} row={row} />
          ))}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function LeakRow({ row }: { row: MockLeakRow }) {
  const followUpTone = row.followedUp
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-red-100 text-red-700'
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={`${ANALYTICS_TABLE_TD} font-medium text-[#05040D]`}>{row.operator}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.client}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.agreement}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-right font-medium`}>
        {row.promiseAmount.toLocaleString()} ₴
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.promiseDateLabel}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${followUpTone}`}>
          {row.followedUp ? 'Followed up' : 'Not followed up'}
        </span>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.callAfterEscalationLabel}</td>
    </tr>
  )
}

export default LeaksSubTab
