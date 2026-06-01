import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MOCK_THIRD_PARTIES,
  MOCK_THIRD_PARTIES_KPIS,
  type MockThirdPartyRow,
  type ThirdPartyResult,
} from '../../mocks/trainerWorkplaceMocks'
import { PeriodFilterStrip, type PeriodOption } from './PeriodFilterStrip'

/**
 * Third Parties sub-tab (KAN-415). Calls to people other than the
 * registered client â€” KPI strip + result-coloured table.
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
  const k = MOCK_THIRD_PARTIES_KPIS

  return (
    <div className="flex flex-col gap-4">
      <PeriodFilterStrip value={period} onChange={setPeriod} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile
          label={t('pages.training.thirdParties.kpi.calls', 'Calls to 3 parties')}
          value={k.callsToThirdParties}
          tone="text-dark-500"
        />
        <KpiTile
          label={t('pages.training.thirdParties.kpi.passedToClient', 'Passed to the client')}
          value={k.passedToClient}
          tone="text-amber-600"
        />
        <KpiTile
          label={t('pages.training.thirdParties.kpi.positiveResult', 'Positive result')}
          value={k.positiveResult}
          tone="text-emerald-600"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['All operators', 'Promise', 'Refusal', 'Will pass on'].map((label, idx) => (
          <button
            key={label}
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              idx === 0
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3">
                {t('pages.training.thirdParties.cols.date', 'Date/Time')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.thirdParties.cols.operator', 'Operator')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.thirdParties.cols.phone', "Client's phone")}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.thirdParties.cols.duration', 'Duration')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.thirdParties.cols.result', 'Result')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.thirdParties.cols.returned', 'Returned to the client')}
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_THIRD_PARTIES.map((row) => (
              <ThirdPartyRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiTile({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <span className="text-[10px] tracking-wide text-gray-500 uppercase">{label}</span>
      <span className={`text-2xl font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

function ThirdPartyRow({ row }: { row: MockThirdPartyRow }) {
  const tone = RESULT_TONE[row.result]
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-600">{row.dateLabel}</td>
      <td className="text-dark-500 px-4 py-3 font-medium">{row.operator}</td>
      <td className="px-4 py-3 text-gray-700">{row.clientPhone}</td>
      <td className="px-4 py-3 text-gray-600">{row.duration}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
          {RESULT_LABEL[row.result]}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-600">{row.returnedToClient}</td>
    </tr>
  )
}

export default ThirdPartiesSubTab
