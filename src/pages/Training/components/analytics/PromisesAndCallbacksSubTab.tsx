import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_PROMISES,
  MOCK_PROMISES_KPIS,
  type MockPromiseRow,
  type PromiseStatus,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Promises and Callbacks sub-tab (KAN-415). KPI strip + table of promised
 * payments with status badge per row.
 */
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
  const k = MOCK_PROMISES_KPIS

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label={t('pages.training.promises.kpi.total', 'Total promises')}
          value={`${k.total.amount.toLocaleString()} ${k.total.currency}`}
          tone="text-dark-500"
        />
        <KpiTile
          label={t('pages.training.promises.kpi.paid', 'Paid')}
          value={`${k.paid.amount.toLocaleString()} ${k.paid.currency}`}
          tone="text-emerald-600"
        />
        <KpiTile
          label={t('pages.training.promises.kpi.pending', 'Pending')}
          value={`${k.pending.count} promises`}
          tone="text-amber-600"
        />
        <KpiTile
          label={t('pages.training.promises.kpi.expected', 'Expected')}
          value={`${k.expected.amount.toLocaleString()} ${k.expected.currency}`}
          tone="text-blue-600"
        />
      </div>

      {/* Overdue banner */}
      <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-red-700">
          <Icons.Warning size={14} />
          {t('pages.training.promises.overdueBanner', 'Overdue promises')}
        </div>
        <span className="text-[11px] text-red-700">
          {t('pages.training.promises.overdueHint', 'Open the list to follow up')}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3">{t('pages.training.promises.cols.date', 'Date/Time')}</th>
              <th className="px-4 py-3">
                {t('pages.training.promises.cols.operator', 'Operator')}
              </th>
              <th className="px-4 py-3">{t('pages.training.promises.cols.client', 'Client')}</th>
              <th className="px-4 py-3">
                {t('pages.training.promises.cols.agreement', 'Agreement')}
              </th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.promises.cols.amount', 'Amount')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.promises.cols.paymentDate', 'Payment date')}
              </th>
              <th className="px-4 py-3">{t('pages.training.promises.cols.status', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PROMISES.map((row) => (
              <PromiseRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
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

function PromiseRow({ row }: { row: MockPromiseRow }) {
  const tone = STATUS_TONE[row.status]
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-600">{row.dateLabel}</td>
      <td className="text-dark-500 px-4 py-3 font-medium">{row.operator}</td>
      <td className="px-4 py-3 text-gray-700">{row.client}</td>
      <td className="px-4 py-3 text-gray-600">{row.agreement}</td>
      <td className="px-4 py-3 text-right font-medium text-gray-700">
        {row.amount.toLocaleString()} â‚´
      </td>
      <td className="px-4 py-3 text-gray-600">{row.paymentDateLabel}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
          {STATUS_LABEL[row.status]}
        </span>
      </td>
    </tr>
  )
}

export default PromisesAndCallbacksSubTab
