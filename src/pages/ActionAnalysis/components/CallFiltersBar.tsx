import { useTranslation } from 'react-i18next'
import type { CallMonitoringFilters, CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'

const PERIODS: CallMonitoringPeriod[] = ['today', 'yesterday', 'last_7d', 'last_30d', 'custom']

interface Props {
  filters: CallMonitoringFilters
  operators: OperatorUser[]
  onChange: (next: Partial<CallMonitoringFilters>) => void
}

export function CallFiltersBar({ filters, operators, onChange }: Props) {
  const { t } = useTranslation('common')

  const operatorsWithExt = operators.filter((o) => !!o.asterisk_extension)
  const selectedExt = filters.agent_extensions?.[0] ?? ''

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">
          {t('pages.actionAnalysis.filters.operator', 'Operator')}
        </span>
        <select
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={selectedExt}
          onChange={(e) => {
            const value = e.target.value
            onChange({ agent_extensions: value ? [value] : undefined })
          }}
        >
          <option value="">{t('pages.actionAnalysis.filters.allOperators', 'All operators')}</option>
          {operatorsWithExt.map((op) => (
            <option key={op.id} value={op.asterisk_extension ?? ''}>
              {op.full_name} ({op.asterisk_extension})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">{t('pages.actionAnalysis.filters.period', 'Period')}</span>
        <select
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={filters.period ?? 'last_7d'}
          onChange={(e) => onChange({ period: e.target.value as CallMonitoringPeriod })}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {t(`pages.actionAnalysis.filters.periods.${p}`, p)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">{t('pages.actionAnalysis.filters.status', 'Status')}</span>
        <select
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={filters.outcome_filter ?? 'all'}
          onChange={(e) =>
            onChange({
              outcome_filter: e.target.value as CallMonitoringFilters['outcome_filter'],
            })
          }
        >
          <option value="all">{t('pages.actionAnalysis.filters.statuses.all', 'All')}</option>
          <option value="answered">
            {t('pages.actionAnalysis.filters.statuses.answered', 'Answered')}
          </option>
          <option value="not_answered">
            {t('pages.actionAnalysis.filters.statuses.notAnswered', 'Not answered')}
          </option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">
          {t('pages.actionAnalysis.filters.minDuration', 'Min duration (s)')}
        </span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={filters.min_duration ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange({ min_duration: v === '' ? undefined : Number(v) })
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">
          {t('pages.actionAnalysis.filters.maxDuration', 'Max duration (s)')}
        </span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={filters.max_duration ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange({ max_duration: v === '' ? undefined : Number(v) })
          }}
        />
      </label>
    </div>
  )
}
