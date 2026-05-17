import { useTranslation } from 'react-i18next'
import type {
  CallMonitoringPeriod,
  PaymentMethod,
  PaymentMonitoringDateField,
  PaymentStatus,
} from '@/features/actionAnalysis'
import {
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
  PAYMENT_TYPE_VALUES,
} from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
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
import {
  PAYMENT_HISTORY_FILTERS_DEFAULT,
  type PaymentHistoryBarState,
} from '../lib/paymentHistoryUrlState'
import type { ScopedUserIds } from '../lib/scope'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

const DATE_FIELDS: readonly PaymentMonitoringDateField[] = [
  'recorded_at',
  'verified_at',
  'payment_date',
]

interface Props {
  value: PaymentHistoryBarState
  operators: OperatorUser[]
  onApply: (next: PaymentHistoryBarState) => void
  onClear: () => void
  userTimezone?: string | null
  scope?: ScopedUserIds
}

function toggleListValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function PaymentHistoryFiltersBar({
  value,
  operators,
  onApply,
  onClear,
  userTimezone,
  scope,
}: Props) {
  const { t } = useTranslation('common')

  const [draft, setDraft] = useSyncedState<PaymentHistoryBarState>(value, value)

  const update = (next: Partial<PaymentHistoryBarState>) => {
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

  const scopeLockedEmpLabel = scope?.employeePickerDisabled
    ? t(scope.disabledLabelKey, 'Scoped')
    : undefined

  const handleApply = () => onApply(draft)
  const handleClearAll = () => {
    setDraft(PAYMENT_HISTORY_FILTERS_DEFAULT)
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

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.paymentDateField', 'Date type')}
            </span>
            <Select
              value={draft.dateField}
              onValueChange={(v) => update({ dateField: v as PaymentMonitoringDateField })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FIELDS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {t(`pages.actionAnalysis.filters.paymentDateFields.${f}`, f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <EmployeeFilterDropdown
            operators={operators}
            selectedIds={draft.employeeIds}
            onChange={(ids) => update({ employeeIds: ids })}
            disabled={scope?.employeePickerDisabled}
            disabledLabel={scopeLockedEmpLabel}
            label={t('pages.actionAnalysis.filters.operator', 'Operator')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.amountMin', 'Min amount')}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              className="h-[45px]"
              value={draft.amountMin ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ amountMin: v === '' ? undefined : Number(v) })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.amountMax', 'Max amount')}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              className="h-[45px]"
              value={draft.amountMax ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ amountMax: v === '' ? undefined : Number(v) })
              }}
            />
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-3 lg:gap-4">
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white/60 p-3">
            <span className="text-dark-500 text-xs font-semibold">
              {t('pages.actionAnalysis.filters.paymentMethod', 'Payment method')}
            </span>
            <div className="flex flex-col gap-1.5">
              {PAYMENT_METHOD_VALUES.map((m: PaymentMethod) => (
                <label key={m} className="flex items-center gap-2 text-sm text-gray-700">
                  <Checkbox
                    checked={draft.paymentMethods.includes(m)}
                    onCheckedChange={() =>
                      update({ paymentMethods: toggleListValue(draft.paymentMethods, m) })
                    }
                  />
                  <span>{t(`pages.actionAnalysis.filters.paymentMethods.${m}`, m)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white/60 p-3">
            <span className="text-dark-500 text-xs font-semibold">
              {t('pages.actionAnalysis.filters.status', 'Status')}
            </span>
            <div className="flex flex-col gap-1.5">
              {PAYMENT_STATUS_VALUES.map((s: PaymentStatus) => (
                <label key={s} className="flex items-center gap-2 text-sm text-gray-700">
                  <Checkbox
                    checked={draft.statuses.includes(s)}
                    onCheckedChange={() => update({ statuses: toggleListValue(draft.statuses, s) })}
                  />
                  <span>{t(`pages.actionAnalysis.filters.paymentStatuses.${s}`, s)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white/60 p-3">
            <span className="text-dark-500 text-xs font-semibold">
              {t('pages.actionAnalysis.filters.paymentType', 'Payment type')}
            </span>
            <div className="flex flex-col gap-1.5">
              {PAYMENT_TYPE_VALUES.map((tt) => (
                <label key={tt} className="flex items-center gap-2 text-sm text-gray-700">
                  <Checkbox
                    checked={draft.paymentTypes.includes(tt)}
                    onCheckedChange={() =>
                      update({ paymentTypes: toggleListValue(draft.paymentTypes, tt) })
                    }
                  />
                  <span>{t(`pages.actionAnalysis.filters.paymentTypes.${tt}`, tt)}</span>
                </label>
              ))}
            </div>
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
