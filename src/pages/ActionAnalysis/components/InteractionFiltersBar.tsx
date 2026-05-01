import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type {
  InteractionContactTypeResponse,
  InteractionResultResponse,
} from '@/features/clients/api/types'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import type { InteractionBarState } from '../lib/interactionsUrlState'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

interface Props {
  state: InteractionBarState
  operators: OperatorUser[]
  results: InteractionResultResponse[]
  contactTypes: InteractionContactTypeResponse[]
  onChange: (next: Partial<InteractionBarState>) => void
  userTimezone?: string | null
}

function buildDepartmentOptions(operators: OperatorUser[]) {
  const map = new Map<number, string>()
  for (const o of operators) {
    if (o.department_id != null) {
      const label = o.department_name?.trim() || `ID ${o.department_id}`
      if (!map.has(o.department_id)) map.set(o.department_id, label)
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function InteractionFiltersBar({
  state,
  operators,
  results,
  contactTypes,
  onChange,
  userTimezone,
}: Props) {
  const { t } = useTranslation('common')

  const period: CallMonitoringPeriod = state.period ?? 'last_7d'
  const selectedResultId = state.result_ids?.[0]
  const selectedContactTypeId = state.contact_type_ids?.[0]

  const departmentOptions = useMemo(() => buildDepartmentOptions(operators), [operators])
  const departmentSelectValue = state.departmentId != null ? String(state.departmentId) : 'all'
  const departmentName =
    state.departmentId != null
      ? (departmentOptions.find((d) => d.id === state.departmentId)?.name ?? undefined)
      : undefined

  return (
    <div className={FILTER_SURFACE}>
      <div className="flex w-full flex-col gap-4 sm:gap-6">
        <DateRangeQuickFilter
          period={period}
          customFromDate={state.customFromDate}
          customToDate={state.customToDate}
          onChange={(next) => onChange(next)}
          userTimezone={userTimezone}
        />

        <div className="h-px w-full bg-gray-200" />

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.department', 'Department')}
            </span>
            <Select
              value={departmentSelectValue}
              onValueChange={(v) => {
                if (v === 'all') {
                  onChange({ departmentId: null })
                } else {
                  onChange({ departmentId: Number(v), employeeIds: [] })
                }
              }}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.allDepartments', 'All departments')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.allDepartments', 'All departments')}
                </SelectItem>
                {departmentOptions.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <EmployeeFilterDropdown
            operators={operators}
            selectedIds={state.employeeIds}
            onChange={(ids) => onChange({ departmentId: null, employeeIds: ids })}
            disabled={state.departmentId != null}
            disabledLabel={departmentName}
            label={t('pages.actionAnalysis.filters.employees', 'Employees')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.contactType', 'Contact type')}
            </span>
            <Select
              value={selectedContactTypeId != null ? String(selectedContactTypeId) : 'all'}
              onValueChange={(v) =>
                onChange({ contact_type_ids: v === 'all' ? undefined : [Number(v)] })
              }
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.allContactTypes', 'All')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.allContactTypes', 'All')}
                </SelectItem>
                {contactTypes.map((ct) => (
                  <SelectItem key={ct.id} value={String(ct.id)}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.result', 'Result')}
            </span>
            <Select
              value={selectedResultId != null ? String(selectedResultId) : 'all'}
              onValueChange={(v) => onChange({ result_ids: v === 'all' ? undefined : [Number(v)] })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue placeholder={t('pages.actionAnalysis.filters.allResults', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.allResults', 'All')}
                </SelectItem>
                {results.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {t(`interactionResults.${r.code}`, { defaultValue: r.name })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.promiseMin', 'Promise min')}
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-[45px]"
              placeholder={t('pages.actionAnalysis.filters.promiseMinPlaceholder', '0.00')}
              value={state.promise_amount_min ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ promise_amount_min: v === '' ? undefined : Number(v) })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.promiseMax', 'Promise max')}
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-[45px]"
              placeholder={t('pages.actionAnalysis.filters.promiseMaxPlaceholder', 'e.g. 1000')}
              value={state.promise_amount_max ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ promise_amount_max: v === '' ? undefined : Number(v) })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
