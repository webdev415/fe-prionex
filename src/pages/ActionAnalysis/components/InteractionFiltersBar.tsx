import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type {
  InteractionContactTypeResponse,
  InteractionResultResponse,
} from '@/features/clients/api/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useSyncedState } from '@/hooks'
import { Icons } from '@/lib/icons'
import { INTERACTION_FILTERS_DEFAULT, type InteractionBarState } from '../lib/interactionsUrlState'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

interface Props {
  value: InteractionBarState
  operators: OperatorUser[]
  results: InteractionResultResponse[]
  contactTypes: InteractionContactTypeResponse[]
  onApply: (next: InteractionBarState) => void
  onClear: () => void
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
  value,
  operators,
  results,
  contactTypes,
  onApply,
  onClear,
  userTimezone,
}: Props) {
  const { t } = useTranslation('common')

  const [draft, setDraft] = useSyncedState<InteractionBarState>(value, value)

  const update = (next: Partial<InteractionBarState>) => {
    setDraft((prev) => {
      const merged = { ...prev, ...next }
      if (merged.period !== 'custom') {
        merged.customFromDate = undefined
        merged.customToDate = undefined
      }
      return merged
    })
  }

  const period: CallMonitoringPeriod = draft.period ?? 'last_7d'
  const selectedResultId = draft.result_ids?.[0]
  const selectedContactTypeId = draft.contact_type_ids?.[0]

  const departmentOptions = useMemo(() => buildDepartmentOptions(operators), [operators])
  const departmentSelectValue = draft.departmentId != null ? String(draft.departmentId) : 'all'
  const departmentName =
    draft.departmentId != null
      ? (departmentOptions.find((d) => d.id === draft.departmentId)?.name ?? undefined)
      : undefined

  const handleApply = () => onApply(draft)
  const handleClearAll = () => {
    setDraft(INTERACTION_FILTERS_DEFAULT)
    onClear()
  }

  return (
    <div className={FILTER_SURFACE}>
      <div className="flex w-full flex-col gap-4 sm:gap-6">
        <DateRangeQuickFilter
          period={period}
          customFromDate={draft.customFromDate}
          customToDate={draft.customToDate}
          onChange={(next) => update(next)}
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
                  update({ departmentId: null })
                } else {
                  update({ departmentId: Number(v), employeeIds: [] })
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
            selectedIds={draft.employeeIds}
            onChange={(ids) => update({ departmentId: null, employeeIds: ids })}
            disabled={draft.departmentId != null}
            disabledLabel={departmentName}
            label={t('pages.actionAnalysis.filters.employee', 'Employee')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.contactType', 'Contact type')}
            </span>
            <Select
              value={selectedContactTypeId != null ? String(selectedContactTypeId) : 'all'}
              onValueChange={(v) =>
                update({ contact_type_ids: v === 'all' ? undefined : [Number(v)] })
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
              onValueChange={(v) => update({ result_ids: v === 'all' ? undefined : [Number(v)] })}
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
              value={draft.promise_amount_min ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ promise_amount_min: v === '' ? undefined : Number(v) })
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
              value={draft.promise_amount_max ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ promise_amount_max: v === '' ? undefined : Number(v) })
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="white-secondary"
            onClick={handleClearAll}
            className="h-[45px] w-full rounded sm:w-auto sm:px-6"
            leftIcon={<Icons.Reload size={16} />}
          >
            {t('pages.actionAnalysis.filters.clearAll', 'Clear All')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleApply}
            className="h-[45px] w-full rounded sm:w-auto sm:px-8"
          >
            {t('pages.actionAnalysis.filters.applyFilters', 'Apply Filters')}
          </Button>
        </div>
      </div>
    </div>
  )
}
