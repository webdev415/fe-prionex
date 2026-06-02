import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MOCK_CLOSURES,
  MOCK_CLOSURES_FUNNEL,
  MOCK_CLOSURES_KPIS,
  type MockClosureRow,
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
 * Successful Closures sub-tab (KAN-415). KPI strip + funnel chart
 * (interactions → promises → payments → closure) + closures table.
 */
export function SuccessfulClosuresSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const k = MOCK_CLOSURES_KPIS

  return (
    <div className="flex flex-col gap-4">
      <PeriodFilterStrip value={period} onChange={setPeriod} />

      {/* KPI strip — shared AnalyticsKpiTile pattern */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.closures', 'Successful closures')}
          value={String(k.successfulClosures)}
          valueTone="text-emerald-600"
          accentColor="bg-[#22C55E]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.totalAmount', 'Total amount')}
          value={`${k.totalAmount.amount.toLocaleString()} ${k.totalAmount.currency}`}
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.conversion', 'Conversion P→P')}
          value={`${k.conversionPromisePaymentPct}%`}
          valueTone="text-violet-600"
          accentColor="bg-[#8B5CF6]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.closures.kpi.leader', 'Closure leader')}
          value={k.closureLeader}
          valueTone="text-blue-600"
          accentColor="bg-[#3B82F6]"
        />
      </div>

      {/* Funnel chart — Figma "Tab 4" frame: 4 horizontal stage cells, each
          with count + label + mini-bar visualization + percentage. Stages
          flow left → right with chevron separators between them. */}
      <div className="rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#05040D]">
            {t(
              'pages.training.closures.funnel.title',
              'Funnel · interactions → promises → payments'
            )}
          </h3>
          <span className="text-[11px] text-[#676767]">
            {t('pages.training.closures.funnel.period', 'Today, real-time')}
          </span>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {MOCK_CLOSURES_FUNNEL.map((stage, idx) => {
            const isLast = idx === MOCK_CLOSURES_FUNNEL.length - 1
            // Approximate the Figma "stacked unit bars" with 10 vertical
            // segments — fill ratio = stage.pct.
            const filledSegments = Math.round((stage.pct / 100) * 10)
            return (
              <div key={stage.label} className="flex flex-1 items-center gap-2">
                <div className="flex flex-1 flex-col gap-2 rounded-lg bg-[#F7F7F7] px-3 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl leading-none font-semibold text-[#05040D]">
                      {stage.actual}
                    </span>
                    <span className="text-[11px] font-medium text-[#676767]">{stage.label}</span>
                  </div>
                  {/* Mini stacked-unit bar visualization */}
                  <div className="flex h-3 gap-0.5">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <span
                        key={j}
                        className={`flex-1 rounded-sm ${
                          j < filledSegments ? 'bg-[#204E4D]' : 'bg-[#EDEDED]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#676767]">{stage.pct}%</span>
                    {!isLast ? <span className="text-[10px] text-[#9CA3AF]">↓</span> : null}
                  </div>
                </div>
                {!isLast ? (
                  <span
                    className="hidden text-base font-medium text-[#9CA3AF] lg:inline-block"
                    aria-hidden
                  >
                    →
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.date', 'Closure date')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.operator', 'Operator')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.client', 'Client')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.agreement', 'Agreement')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.closures.cols.amount', 'Payment amount')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.closures.cols.status', 'Status in CRM')}
            </th>
          </tr>
        </thead>
        <tbody>
          {MOCK_CLOSURES.map((row) => (
            <ClosureRow key={row.id} row={row} />
          ))}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function ClosureRow({ row }: { row: MockClosureRow }) {
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>{row.closureDateLabel}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-medium text-[#05040D]`}>{row.operator}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.client}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.agreement}</td>
      <td className={`${ANALYTICS_TABLE_TD} text-right font-medium`}>
        {row.paymentAmount.toLocaleString()} ₴
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          {row.statusInCrm}
        </span>
      </td>
    </tr>
  )
}

export default SuccessfulClosuresSubTab
