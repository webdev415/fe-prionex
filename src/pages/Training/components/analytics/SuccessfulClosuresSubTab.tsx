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

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label={t('pages.training.closures.kpi.closures', 'Successful closures')}
          value={String(k.successfulClosures)}
          tone="text-emerald-600"
        />
        <KpiTile
          label={t('pages.training.closures.kpi.totalAmount', 'Total amount')}
          value={`${k.totalAmount.amount.toLocaleString()} ${k.totalAmount.currency}`}
          tone="text-dark-500"
        />
        <KpiTile
          label={t('pages.training.closures.kpi.conversion', 'Conversion P→P')}
          value={`${k.conversionPromisePaymentPct}%`}
          tone="text-violet-600"
        />
        <KpiTile
          label={t('pages.training.closures.kpi.leader', 'Closure leader')}
          value={k.closureLeader}
          tone="text-blue-600"
        />
      </div>

      {/* Funnel chart */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-dark-500 text-sm font-semibold">
            {t(
              'pages.training.closures.funnel.title',
              'Funnel · interactions → promises → payments'
            )}
          </h3>
          <span className="text-[11px] text-gray-500">
            {t('pages.training.closures.funnel.period', 'Today, real-time')}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {MOCK_CLOSURES_FUNNEL.map((stage, idx) => (
            <div key={stage.label} className="flex items-center gap-3">
              <div className="w-24 flex-shrink-0 text-[11px] font-medium text-gray-700">
                {stage.label}
              </div>
              <div className="relative flex-1">
                <div className="h-8 overflow-hidden rounded-lg bg-gray-100">
                  <div
                    className="flex h-full items-center justify-end rounded-lg bg-[#204E4D] pr-2 text-[10px] font-medium text-white"
                    style={{ width: `${stage.pct}%` }}
                  >
                    {stage.actual}
                  </div>
                </div>
              </div>
              <span className="w-12 text-right text-[11px] font-medium text-gray-600">
                {stage.pct}%
              </span>
              {idx < MOCK_CLOSURES_FUNNEL.length - 1 ? (
                <span className="text-[10px] text-gray-400">↓</span>
              ) : null}
            </div>
          ))}
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

function KpiTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <span className="text-[10px] tracking-wide text-gray-500 uppercase">{label}</span>
      <span className={`text-lg font-semibold ${tone}`}>{value}</span>
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
