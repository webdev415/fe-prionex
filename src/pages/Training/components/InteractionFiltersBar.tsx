import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CallMonitoringPeriod, InteractionInternalDateType } from '@/features/training'
import { useInteractionChannels } from '@/features/training'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type {
  InteractionContactTypeResponse,
  InteractionResultResponse,
} from '@/features/clients/api/types'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
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
import type { ScopedUserIds } from '../lib/scope'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'

const FILTER_SURFACE =
  'rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)] sm:p-6'

interface Props {
  value: InteractionBarState
  operators: OperatorUser[]
  results: InteractionResultResponse[]
  contactTypes: InteractionContactTypeResponse[]
  onApply: (next: InteractionBarState) => void
  onClear: () => void
  userTimezone?: string | null
  /** Page-level scope (KAN-506) — drives the picker-disabled flags. */
  scope?: ScopedUserIds
}

function parseYmd(dateStr: string | undefined): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function formatYmd(d: Date | null): string | undefined {
  if (!d) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
  scope,
}: Props) {
  const { t } = useTranslation('common')

  const scopeLockedDeptLabel = scope?.departmentPickerDisabled
    ? t(scope.disabledLabelKey, 'Scoped')
    : undefined
  const scopeLockedEmpLabel = scope?.employeePickerDisabled
    ? t(scope.disabledLabelKey, 'Scoped')
    : undefined

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

  // Distinct channels for the dropdown source. Project-scoped, 5-min cache.
  const { data: channels = [] } = useInteractionChannels()

  const internalDateType: InteractionInternalDateType | undefined = draft.internal_date_type
  const internalDateRangeActive = !!internalDateType
  const parsedInternalFrom = parseYmd(draft.internal_date_from)
  const parsedInternalTo = parseYmd(draft.internal_date_to)

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

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.department', 'Department')}
            </span>
            <Select
              value={departmentSelectValue}
              disabled={scope?.departmentPickerDisabled}
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
                  placeholder={
                    scopeLockedDeptLabel ??
                    t('pages.training.filters.allDepartments', 'All departments')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.allDepartments', 'All departments')}
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
            disabled={draft.departmentId != null || scope?.employeePickerDisabled}
            disabledLabel={scopeLockedEmpLabel ?? departmentName}
            label={t('pages.training.filters.employee', 'Employee')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.contactType', 'Contact type')}
            </span>
            <Select
              value={selectedContactTypeId != null ? String(selectedContactTypeId) : 'all'}
              onValueChange={(v) =>
                update({ contact_type_ids: v === 'all' ? undefined : [Number(v)] })
              }
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue placeholder={t('pages.training.filters.allContactTypes', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.allContactTypes', 'All')}
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
              {t('pages.training.filters.result', 'Result')}
            </span>
            <Select
              value={selectedResultId != null ? String(selectedResultId) : 'all'}
              onValueChange={(v) => update({ result_ids: v === 'all' ? undefined : [Number(v)] })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue placeholder={t('pages.training.filters.allResults', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.training.filters.allResults', 'All')}</SelectItem>
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
              {t('pages.training.filters.channel', 'Channel')}
            </span>
            <Select
              value={draft.channel ?? 'all'}
              onValueChange={(v) => update({ channel: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue placeholder={t('pages.training.filters.allChannels', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.allChannels', 'All')}
                </SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.promiseMin', 'Promise min')}
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-[45px]"
              placeholder={t('pages.training.filters.promiseMinPlaceholder', '0.00')}
              value={draft.promise_amount_min ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ promise_amount_min: v === '' ? undefined : Number(v) })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.promiseMax', 'Promise max')}
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-[45px]"
              placeholder={t('pages.training.filters.promiseMaxPlaceholder', 'e.g. 1000')}
              value={draft.promise_amount_max ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ promise_amount_max: v === '' ? undefined : Number(v) })
              }}
            />
          </div>

          {/*
            Internal-date filter (KAN-409 follow-up): one combined filter that
            targets a chosen date column inside the interaction (promise / next
            action / follow-up, or `any` = OR). Bounds are required for the
            filter to apply, so picking a type alone is a no-op on the backend.
            Lives in the same grid as the other filters so the row layout
            stays exactly 2 rows of 5 at xl+ (10 cells total).
          */}
          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.internalDateType', 'Internal date')}
            </span>
            <Select
              value={internalDateType ?? 'none'}
              onValueChange={(v) => {
                if (v === 'none') {
                  update({
                    internal_date_type: undefined,
                    internal_date_from: undefined,
                    internal_date_to: undefined,
                  })
                } else {
                  update({ internal_date_type: v as InteractionInternalDateType })
                }
              }}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.training.filters.internalDateTypeNone', 'Off')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t('pages.training.filters.internalDateTypeNone', 'Off')}
                </SelectItem>
                <SelectItem value="promise_to_pay">
                  {t('pages.training.filters.internalDateTypes.promiseToPay', 'Promise to pay')}
                </SelectItem>
                <SelectItem value="next_action">
                  {t(
                    'pages.training.filters.internalDateTypes.nextAction',
                    'Callback / next action'
                  )}
                </SelectItem>
                <SelectItem value="follow_up">
                  {t('pages.training.filters.internalDateTypes.followUp', 'Follow-up')}
                </SelectItem>
                <SelectItem value="any">
                  {t('pages.training.filters.internalDateTypes.any', 'Any of the above')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.internalDateFrom', 'Internal date from')}
            </span>
            <DateSelect
              value={parsedInternalFrom}
              onChange={({ value }) =>
                update({ internal_date_from: formatYmd(value) ?? undefined })
              }
              placeholder={t('pages.training.filters.selectStartDate', 'Select start date')}
              max={parsedInternalTo ?? undefined}
              allowManualInput
              format="dd.MM.yyyy"
              className="h-[45px] rounded-lg border-gray-400"
              disabled={!internalDateRangeActive}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.internalDateTo', 'Internal date to')}
            </span>
            <DateSelect
              value={parsedInternalTo}
              onChange={({ value }) => update({ internal_date_to: formatYmd(value) ?? undefined })}
              placeholder={t('pages.training.filters.selectEndDate', 'Select end date')}
              min={parsedInternalFrom ?? undefined}
              allowManualInput
              format="dd.MM.yyyy"
              className="h-[45px] rounded-lg border-gray-400"
              disabled={!internalDateRangeActive}
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
            {t('pages.training.filters.clearAll', 'Clear All')}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            className="h-[45px] w-full rounded bg-[#204E4D] text-white hover:bg-[#1a3f3e] sm:w-auto sm:px-8"
          >
            {t('pages.training.filters.applyFilters', 'Apply Filters')}
          </Button>
        </div>
      </div>
    </div>
  )
}
