import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_LEAKS, MOCK_LEAKS_KPIS, type MockLeakRow } from '../../mocks/trainerWorkplaceMocks'

/**
 * Leaks sub-tab (KAN-415). Escalations / lost-client view â€” KPI strip +
 * follow-up filter chips + table.
 */
export function LeaksSubTab() {
  const { t } = useTranslation('common')
  const k = MOCK_LEAKS_KPIS

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-[11px] text-emerald-700">
        {t(
          'pages.training.leaks.healthBanner',
          'Escalation rate sits within healthy bounds for the current period.'
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile
          label={t('pages.training.leaks.kpi.totalEscalations', 'Total escalations')}
          value={k.totalEscalations}
          tone="text-dark-500"
        />
        <KpiTile
          label={t('pages.training.leaks.kpi.notFollowedUp', 'Not followed up')}
          value={k.notFollowedUp}
          tone="text-red-600"
        />
        <KpiTile
          label={t('pages.training.leaks.kpi.followedUp', 'Followed up')}
          value={k.followedUp}
          tone="text-emerald-600"
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-red-700">
          <Icons.Warning size={14} />
          {t(
            'pages.training.leaks.escalationBanner',
            'Escalations without follow-up â€” take action'
          )}
        </div>
      </div>

      {/* Follow-up chips */}
      <div className="flex flex-wrap items-center gap-2">
        {['All', 'Not followed up', 'Followed up'].map((label, idx) => (
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
              <th className="px-4 py-3">{t('pages.training.leaks.cols.operator', 'Operator')}</th>
              <th className="px-4 py-3">{t('pages.training.leaks.cols.client', 'Client')}</th>
              <th className="px-4 py-3">{t('pages.training.leaks.cols.agreement', 'Agreement')}</th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.leaks.cols.amount', 'Amount of promise')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.leaks.cols.dateOfPromise', 'Date of promise')}
              </th>
              <th className="px-4 py-3">{t('pages.training.leaks.cols.followUp', 'Follow-up')}</th>
              <th className="px-4 py-3">
                {t('pages.training.leaks.cols.callAfter', 'Call after escalation')}
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LEAKS.map((row) => (
              <LeakRow key={row.id} row={row} />
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

function LeakRow({ row }: { row: MockLeakRow }) {
  const followUpTone = row.followedUp
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-red-100 text-red-700'
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="text-dark-500 px-4 py-3 font-medium">{row.operator}</td>
      <td className="px-4 py-3 text-gray-700">{row.client}</td>
      <td className="px-4 py-3 text-gray-600">{row.agreement}</td>
      <td className="px-4 py-3 text-right font-medium text-gray-700">
        {row.promiseAmount.toLocaleString()} â‚´
      </td>
      <td className="px-4 py-3 text-gray-600">{row.promiseDateLabel}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${followUpTone}`}>
          {row.followedUp ? 'Followed up' : 'Not followed up'}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-600">{row.callAfterEscalationLabel}</td>
    </tr>
  )
}

export default LeaksSubTab
