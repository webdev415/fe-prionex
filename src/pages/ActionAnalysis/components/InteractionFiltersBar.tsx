import { useTranslation } from 'react-i18next'
import type {
  CallMonitoringPeriod,
  InteractionMonitoringFilters,
} from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type {
  InteractionContactTypeResponse,
  InteractionResultResponse,
} from '@/features/clients/api/types'

const PERIODS: CallMonitoringPeriod[] = ['today', 'yesterday', 'last_7d', 'last_30d', 'custom']

interface Props {
  filters: InteractionMonitoringFilters
  operators: OperatorUser[]
  results: InteractionResultResponse[]
  contactTypes: InteractionContactTypeResponse[]
  onChange: (next: Partial<InteractionMonitoringFilters>) => void
}

export function InteractionFiltersBar({
  filters,
  operators,
  results,
  contactTypes,
  onChange,
}: Props) {
  const { t } = useTranslation('common')

  const selectedUserId = filters.user_ids?.[0] ?? ''
  const selectedResultId = filters.result_ids?.[0] ?? ''
  const selectedContactTypeId = filters.contact_type_ids?.[0] ?? ''

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">
          {t('pages.actionAnalysis.filters.employee', 'Employee')}
        </span>
        <select
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={selectedUserId === '' ? '' : String(selectedUserId)}
          onChange={(e) => {
            const v = e.target.value
            onChange({ user_ids: v ? [Number(v)] : undefined })
          }}
        >
          <option value="">{t('pages.actionAnalysis.filters.allEmployees', 'All employees')}</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.full_name}
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
        <span className="text-gray-700">
          {t('pages.actionAnalysis.filters.contactType', 'Contact type')}
        </span>
        <select
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={selectedContactTypeId === '' ? '' : String(selectedContactTypeId)}
          onChange={(e) => {
            const v = e.target.value
            onChange({ contact_type_ids: v ? [Number(v)] : undefined })
          }}
        >
          <option value="">{t('pages.actionAnalysis.filters.allContactTypes', 'All')}</option>
          {contactTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">
          {t('pages.actionAnalysis.filters.result', 'Result')}
        </span>
        <select
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={selectedResultId === '' ? '' : String(selectedResultId)}
          onChange={(e) => {
            const v = e.target.value
            onChange({ result_ids: v ? [Number(v)] : undefined })
          }}
        >
          <option value="">{t('pages.actionAnalysis.filters.allResults', 'All')}</option>
          {results.map((r) => (
            <option key={r.id} value={r.id}>
              {t(`interactionResults.${r.code}`, { defaultValue: r.name })}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">
          {t('pages.actionAnalysis.filters.promiseMin', 'Promise min')}
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={filters.promise_amount_min ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange({ promise_amount_min: v === '' ? undefined : Number(v) })
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-700">
          {t('pages.actionAnalysis.filters.promiseMax', 'Promise max')}
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          value={filters.promise_amount_max ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange({ promise_amount_max: v === '' ? undefined : Number(v) })
          }}
        />
      </label>
    </div>
  )
}
