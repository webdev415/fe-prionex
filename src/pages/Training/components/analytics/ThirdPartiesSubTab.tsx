import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_THIRD_PARTIES,
  MOCK_THIRD_PARTIES_KPIS,
  type MockThirdPartyRow,
  type ThirdPartyResult,
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
 * Third Parties sub-tab (KAN-415). Mirrors the Figma frame:
 *   1) 4 horizontal icon-tile KPIs (Calls / Returned / Did not return /
 *      Positive)
 *   2) Filter strip — "All operators" dropdown + result chip strip
 *      (All results / Promise / Refusal / Missed call / Will pass on)
 *   3) Table — operator avatar+presence dot, blue client code, third-party
 *      phone with relation sub-label, result pill, Returned-to-client cell
 *      with check (Yes + timestamp) or cross (Did not return)
 */

type ResultFilter = 'all' | ThirdPartyResult

const RESULT_TONE: Record<ThirdPartyResult, string> = {
  promise: 'bg-emerald-100 text-emerald-700',
  refusal: 'bg-red-100 text-red-700',
  will_pass_on: 'bg-blue-100 text-blue-700',
  positive: 'bg-blue-100 text-blue-700',
  missed_call: 'bg-gray-100 text-gray-600',
}

const RESULT_LABEL: Record<ThirdPartyResult, string> = {
  promise: 'Promise',
  refusal: 'Refusal',
  will_pass_on: 'Will pass on',
  positive: 'Positive',
  missed_call: 'Missed call',
}

const PRESENCE_DOT: Record<NonNullable<MockThirdPartyRow['operatorPresence']>, string> = {
  online: 'bg-[#22C55E]',
  busy: 'bg-[#F59E0B]',
  offline: 'bg-[#A1A1A1]',
}

const ALL_OPERATORS = Array.from(new Set(MOCK_THIRD_PARTIES.map((r) => r.operator))).sort()

const RESULT_CHIPS: ResultFilter[] = [
  'all',
  'promise',
  'refusal',
  'missed_call',
  'will_pass_on',
]

export function ThirdPartiesSubTab() {
  const { t } = useTranslation('common')
  const [operatorFilter, setOperatorFilter] = useState<string>('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const k = MOCK_THIRD_PARTIES_KPIS

  const filteredRows = MOCK_THIRD_PARTIES.filter((row) => {
    if (operatorFilter !== 'all' && row.operator !== operatorFilter) return false
    if (resultFilter !== 'all' && row.result !== resultFilter) return false
    return true
  })

  const resultCount = (id: ResultFilter): number =>
    id === 'all' ? MOCK_THIRD_PARTIES.length : MOCK_THIRD_PARTIES.filter((r) => r.result === id).length

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — 4 horizontal icon tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.calls', 'Calls to 3 people')}
          value={k.callsToThirdParties}
          icon={<Icons.Call02 size={18} />}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.returned', 'Returned to the client')}
          value={k.returnedToClient}
          icon={<Icons.UserCheck01 size={18} />}
          iconBg="bg-[#EFF6FF]"
          iconTone="text-[#3B82F6]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.didNotReturn', 'Did not return to the client')}
          value={k.didNotReturn}
          icon={<Icons.User size={18} />}
          iconBg="bg-[#FEF2F2]"
          iconTone="text-[#EF4444]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.positiveResult', 'Positive result')}
          value={k.positiveResult}
          icon={<Icons.Success size={18} />}
          iconBg="bg-[#ECFDF5]"
          iconTone="text-[#22C55E]"
        />
      </div>

      {/* Filter strip — operator dropdown on left, result chips on right */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="relative min-w-[200px]">
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="all">
              {t('pages.training.thirdParties.filters.allOperators', 'All operators')}
            </option>
            {ALL_OPERATORS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <Icons.ArrowDown
            size={12}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RESULT_CHIPS.map((id) => {
            const isActive = resultFilter === id
            const label =
              id === 'all'
                ? t('pages.training.thirdParties.chips.allResults', 'All results')
                : RESULT_LABEL[id]
            const count = resultCount(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => setResultFilter(id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#204E4D] text-white'
                    : 'text-[#545454] hover:bg-[#F7F7F7]'
                }`}
              >
                {label}
                {id === 'all' ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.date', 'Date / Time')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.operator', 'Operator')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.clientMain', 'Client (main)')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.thirdPartyPhone', 'Third party phone')}
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
            <ThirdPartyRow
              key={row.id}
              row={row}
              yesLabel={t('pages.training.thirdParties.returned.yes', 'Yes')}
              didNotReturnLabel={t(
                'pages.training.thirdParties.returned.no',
                'Did not return'
              )}
            />
          ))}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function ThirdPartyRow({
  row,
  yesLabel,
  didNotReturnLabel,
}: {
  row: MockThirdPartyRow
  yesLabel: string
  didNotReturnLabel: string
}) {
  const tone = RESULT_TONE[row.result]
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>{row.dateLabel}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          {row.operatorInitials ? (
            <span className="relative flex-shrink-0">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
                style={{ backgroundColor: row.operatorAvatarColor ?? '#EDEDED' }}
              >
                {row.operatorInitials}
              </span>
              {row.operatorPresence ? (
                <span
                  className={`absolute right-0 bottom-0 h-2 w-2 rounded-full border border-white ${PRESENCE_DOT[row.operatorPresence]}`}
                  aria-hidden
                />
              ) : null}
            </span>
          ) : null}
          <span className="text-xs font-medium text-[#05040D]">{row.operator}</span>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-[#3B82F6]`}>{row.clientCode}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-[#05040D]">{row.thirdPartyPhone}</span>
          <span className="text-[11px] text-[#676767]">{row.thirdPartyRelation}</span>
        </div>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.duration}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
          {RESULT_LABEL[row.result]}
        </span>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        {row.returnedToClient ? (
          <div className="flex flex-col leading-tight">
            <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-emerald-600">
              <Icons.Success size={10} />
              {yesLabel}
            </span>
            {row.returnedAtLabel ? (
              <span className="mt-0.5 text-[10px] text-[#9CA3AF]">{row.returnedAtLabel}</span>
            ) : null}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#EF4444]">
            <Icons.Close size={10} />
            {didNotReturnLabel}
          </span>
        )}
      </td>
    </tr>
  )
}

export default ThirdPartiesSubTab
