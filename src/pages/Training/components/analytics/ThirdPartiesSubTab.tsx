import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MOCK_THIRD_PARTIES,
  MOCK_THIRD_PARTIES_KPIS,
  type MockThirdPartyRow,
  type ThirdPartyResult,
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
 * Third Parties sub-tab (KAN-415). Calls to people other than the
 * registered client — KPI strip + result-coloured table.
 */
const RESULT_TONE: Record<ThirdPartyResult, string> = {
  promise: 'bg-emerald-100 text-emerald-700',
  refusal: 'bg-red-100 text-red-700',
  will_pass_on: 'bg-amber-100 text-amber-700',
  positive: 'bg-blue-100 text-blue-700',
}

const RESULT_LABEL: Record<ThirdPartyResult, string> = {
  promise: 'Promise',
  refusal: 'Refusal',
  will_pass_on: 'Will pass on',
  positive: 'Positive',
}

export function ThirdPartiesSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [resultFilter, setResultFilter] = useState<'all' | ThirdPartyResult>('all')
  const k = MOCK_THIRD_PARTIES_KPIS

  const filteredRows = MOCK_THIRD_PARTIES.filter(
    (row) => resultFilter === 'all' || row.result === resultFilter
  )

  return (
    <div className="flex flex-col gap-4">
      <PeriodFilterStrip
        value={period}
        onChange={setPeriod}
        extraChips={(['all', 'promise', 'refusal', 'will_pass_on'] as const).map((s) => ({
          id: s,
          label: s === 'all' ? 'All operators' : RESULT_LABEL[s],
          active: resultFilter === s,
          onClick: () => setResultFilter(s),
        }))}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.calls', 'Calls to 3 parties')}
          value={k.callsToThirdParties}
        />
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.passedToClient', 'Passed to the client')}
          value={k.passedToClient}
          valueTone="text-amber-600"
          accentColor="bg-[#CA8A04]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.positiveResult', 'Positive result')}
          value={k.positiveResult}
          valueTone="text-emerald-600"
          accentColor="bg-[#22C55E]"
        />
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.date', 'Date/Time')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.operator', 'Operator')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.phone', "Client's phone")}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.duration', 'Duration')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.result', 'Result')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.returned', 'Returned to the client')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <ThirdPartyRow key={row.id} row={row} />
          ))}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function ThirdPartyRow({ row }: { row: MockThirdPartyRow }) {
  const tone = RESULT_TONE[row.result]
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>{row.dateLabel}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-medium text-[#05040D]`}>{row.operator}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.clientPhone}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.duration}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
          {RESULT_LABEL[row.result]}
        </span>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.returnedToClient}</td>
    </tr>
  )
}

export default ThirdPartiesSubTab
