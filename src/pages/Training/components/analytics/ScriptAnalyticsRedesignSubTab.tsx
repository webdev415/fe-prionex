import { useTranslation } from 'react-i18next'
import {
  MOCK_SCRIPT_ALERTS,
  MOCK_SCRIPT_DISTRIBUTION,
  type MockScriptAlert,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Script Analytics redesign â€” Auto-flagged calls list + result distribution
 * by operator. The funnel + pain-points view from KAN-503 lands in a later
 * step; this is the boilerplate for the current-state view.
 */
const SEVERITY_DOT: Record<MockScriptAlert['severity'], string> = {
  info: 'bg-blue-500',
  warn: 'bg-amber-500',
  critical: 'bg-red-500',
}

export function ScriptAnalyticsRedesignSubTab() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col gap-4">
      {/* Auto-flag alerts */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-dark-500 text-sm font-semibold">
            {t('pages.training.script.alerts.title', 'Automatic flags â€” require attention')}
          </h3>
        </div>
        <ul className="divide-y divide-gray-100">
          {MOCK_SCRIPT_ALERTS.map((alert) => (
            <li key={alert.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
              <span
                className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[alert.severity]}`}
              />
              <span className="text-dark-500 flex-1 text-xs font-medium">{alert.message}</span>
              <span className="text-[11px] text-gray-600">{alert.operator}</span>
              <span className="text-[10px] text-gray-400">{alert.timeLabel}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Result distribution by operators */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-dark-500 text-sm font-semibold">
            {t('pages.training.script.distribution.title', 'Distribution of results by operators')}
          </h3>
          <span className="text-[11px] text-gray-500">
            {t('pages.training.script.distribution.allDepts', 'All departments')}
          </span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3">
                {t('pages.training.script.distribution.cols.operator', 'Operator')}
              </th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.script.distribution.cols.total', 'Total')}
              </th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.script.distribution.cols.promises', 'Promises')}
              </th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.script.distribution.cols.refusals', 'Refusals')}
              </th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.script.distribution.cols.missedCalls', 'Missed calls')}
              </th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.script.distribution.cols.willPass', 'Will pass')}
              </th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.script.distribution.cols.flags', 'Flags')}
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_SCRIPT_DISTRIBUTION.map((row) => (
              <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
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
                <td className="text-dark-500 px-4 py-3 text-right font-semibold">{row.total}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{row.promises}</td>
                <td className="px-4 py-3 text-right text-red-600">{row.refusals}</td>
                <td className="px-4 py-3 text-right text-amber-600">{row.missedCalls}</td>
                <td className="px-4 py-3 text-right text-violet-600">{row.willPass}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                    ðŸš© {row.flags}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ScriptAnalyticsRedesignSubTab
