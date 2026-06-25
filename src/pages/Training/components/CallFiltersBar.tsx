import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CallMonitoringFilters,
  CallMonitoringPeriod,
  TelephonyType,
} from '@/features/training'
import type { OperatorUser } from '@/features/users/api/usersApi'
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
import { CALL_FILTERS_DEFAULT } from '../lib/callsUrlState'
import type { ScopedUserIds } from '../lib/scope'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

export type CallFiltersBarValue = Omit<CallMonitoringFilters, 'from_datetime' | 'to_datetime'> & {
  customFromDate?: string
  customToDate?: string
}

interface Props {
  value: CallFiltersBarValue
  operators: OperatorUser[]
  onApply: (next: CallFiltersBarValue) => void
  onClear: () => void
  userTimezone?: string | null
  /** Page-level scope (KAN-506) — drives the picker-disabled flags. */
  scope?: ScopedUserIds
}

export function CallFiltersBar({ value, operators, onApply, onClear, userTimezone, scope }: Props) {
  const { t } = useTranslation('common')

  const scopeLockedEmpLabel = scope?.employeePickerDisabled
    ? t(scope.disabledLabelKey, 'Scoped')
    : undefined

  const operatorsWithExt = useMemo(
    () => operators.filter((o) => !!o.asterisk_extension),
    [operators]
  )

  const [draft, setDraft] = useSyncedState<CallFiltersBarValue>(value, value)

  const update = (next: Partial<CallFiltersBarValue>) => {
    setDraft((prev) => {
      const merged = { ...prev, ...next }
      // Custom period without dates is invalid; drop the dates if the
      // user switches away from custom.
      if (merged.period !== 'custom') {
        merged.customFromDate = undefined
        merged.customToDate = undefined
      }
      return merged
    })
  }

  const selectedOperatorIds = useMemo(() => {
    const exts = draft.agent_extensions ?? []
    return operatorsWithExt
      .filter((o) => exts.includes(o.asterisk_extension as string))
      .map((o) => o.id)
  }, [operatorsWithExt, draft.agent_extensions])

  const period: CallMonitoringPeriod = draft.period ?? 'last_7d'

  const handleEmployeesChange = (ids: number[]) => {
    if (ids.length === 0) {
      update({ agent_extensions: undefined })
      return
    }
    const exts = ids
      .map((id) => operatorsWithExt.find((o) => o.id === id)?.asterisk_extension)
      .filter((e): e is string => !!e)
    update({ agent_extensions: exts.length ? exts : undefined })
  }

  const handleApply = () => onApply(draft)
  const handleClearAll = () => {
    setDraft(CALL_FILTERS_DEFAULT)
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
          <EmployeeFilterDropdown
            operators={operatorsWithExt}
            selectedIds={selectedOperatorIds}
            onChange={handleEmployeesChange}
            disabled={scope?.employeePickerDisabled}
            disabledLabel={scopeLockedEmpLabel}
            label={t('pages.training.filters.employee', 'Employee')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.phone', 'Phone')}
            </span>
            <Input
              type="tel"
              inputMode="tel"
              className="h-[45px]"
              placeholder={t('pages.training.filters.phonePlaceholder', 'e.g. 0631234567')}
              value={draft.phone_number ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ phone_number: v === '' ? undefined : v })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.status', 'Status')}
            </span>
            <Select
              value={draft.outcome_filter ?? 'all'}
              onValueChange={(v) =>
                update({
                  outcome_filter: v as CallMonitoringFilters['outcome_filter'],
                })
              }
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.statuses.all', 'All')}
                </SelectItem>
                <SelectItem value="answered">
                  {t('pages.training.filters.statuses.answered', 'Answered')}
                </SelectItem>
                <SelectItem value="no_answer">
                  {t('pages.clients.statuses.noAnswer', 'No answer')}
                </SelectItem>
                <SelectItem value="busy">{t('pages.clients.statuses.busy', 'Busy')}</SelectItem>
                <SelectItem value="cancel">
                  {t('pages.clients.statuses.cancel', 'Cancelled')}
                </SelectItem>
                <SelectItem value="unavailable">
                  {t('pages.clients.statuses.unavailable', 'Unavailable')}
                </SelectItem>
                <SelectItem value="congestion">
                  {t('pages.clients.statuses.congestion', 'Congestion')}
                </SelectItem>
                <SelectItem value="failed">
                  {t('pages.clients.statuses.failed', 'Failed')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.minDuration', 'Min duration (s)')}
            </span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-[45px]"
              placeholder={t('pages.training.filters.minDurationPlaceholder', 'e.g. 30')}
              value={draft.min_duration ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ min_duration: v === '' ? undefined : Number(v) })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.maxDuration', 'Max duration (s)')}
            </span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-[45px]"
              placeholder={t('pages.training.filters.maxDurationPlaceholder', 'e.g. 600')}
              value={draft.max_duration ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ max_duration: v === '' ? undefined : Number(v) })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.telephonyType', 'Telephony type')}
            </span>
            <Select
              value={draft.telephony_types?.[0] ?? 'all'}
              onValueChange={(v) => {
                if (v === 'all') {
                  update({ telephony_types: undefined })
                } else {
                  update({ telephony_types: [v as TelephonyType] })
                }
              }}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.telephonyTypes.all', 'All')}
                </SelectItem>
                <SelectItem value="white">
                  {t('pages.training.filters.telephonyTypes.white', 'White')}
                </SelectItem>
                <SelectItem value="grey">
                  {t('pages.training.filters.telephonyTypes.grey', 'Grey')}
                </SelectItem>
                <SelectItem value="unknown">
                  {t('pages.training.filters.telephonyTypes.unknown', 'Unknown')}
                </SelectItem>
              </SelectContent>
            </Select>
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
            variant="secondary"
            onClick={handleApply}
            className="h-[45px] w-full rounded sm:w-auto sm:px-8"
          >
            {t('pages.training.filters.applyFilters', 'Apply Filters')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Keep `CallMonitoringPeriod` re-exported for callers that already import the type from this module.
export type { CallMonitoringPeriod }
