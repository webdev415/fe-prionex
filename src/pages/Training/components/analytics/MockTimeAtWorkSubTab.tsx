import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MOCK_TIME_AT_WORK,
  MOCK_TIME_AT_WORK_KPIS,
  type MockTimeAtWorkRow,
} from '../../mocks/trainerWorkplaceMocks'
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
 * Time at Work sub-tab (KAN-415). Mock-data variant of the legacy
 * ScreenTimeTab — KPI strip showing team-level averages on top, table of
 * per-operator timing stats below. Mirrors the Figma "Time at Work" frame.
 */
export function MockTimeAtWorkSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const k = MOCK_TIME_AT_WORK_KPIS

  const tiles = [
    {
      key: 'to-lead',
      label: t('pages.training.timeAtWork.kpi.toLead', 'To lead (average)'),
      value: k.toLeadAvg,
    },
    {
      key: 'credits',
      label: t('pages.training.timeAtWork.kpi.credits', 'Credits (average)'),
      value: k.creditsAvg,
    },
    {
      key: 'to-form',
      label: t('pages.training.timeAtWork.kpi.toForm', 'To form'),
      value: k.toFormAvg,
    },
    {
      key: 'downtime',
      label: t('pages.training.timeAtWork.kpi.downtime', 'Downtime'),
      value: k.downtimeAvg,
    },
    {
      key: 'after-call',
      label: t('pages.training.timeAtWork.kpi.afterCall', 'After call (average)'),
      value: k.afterCallAvg,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PeriodFilterStrip value={period} onChange={setPeriod} />

      {/* KPI strip — shared AnalyticsKpiTile pattern */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <AnalyticsKpiTile key={tile.key} label={tile.label} value={tile.value} />
        ))}
      </div>

      <h2 className="text-dark-500 text-base font-semibold">
        {t('pages.training.timeAtWork.title', 'Time in work by operators')}
      </h2>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.timeAtWork.cols.operator', 'Operator')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.timeAtWork.cols.calls', 'Calls')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.timeAtWork.cols.timeToLead', 'Time to lead')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.timeAtWork.cols.successCredits', 'Succ. Credits')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.timeAtWork.cols.fillForms', 'Fill forms')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.timeAtWork.cols.downtime', 'Downtime (AHT)')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.timeAtWork.cols.afterCall', 'After call')}
            </th>
          </tr>
        </thead>
        <tbody>
          {MOCK_TIME_AT_WORK.map((row) => (
            <TimeAtWorkRow key={row.id} row={row} />
          ))}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function TimeAtWorkRow({ row }: { row: MockTimeAtWorkRow }) {
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-gray-700"
            style={{ backgroundColor: row.avatarColor }}
          >
            {row.initials}
          </div>
          <span className="text-dark-500 text-xs font-medium">{row.operator}</span>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-right font-semibold text-[#05040D]`}>
        {row.calls}
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-right`}>{row.timeToLead}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-right text-emerald-600`}>{row.successCredits}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-right`}>{row.fillForms}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-right text-amber-600`}>{row.downtime}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-right text-violet-600`}>{row.afterCall}</td>
    </tr>
  )
}

export default MockTimeAtWorkSubTab
