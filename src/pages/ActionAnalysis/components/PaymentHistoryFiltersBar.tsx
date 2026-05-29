import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CallMonitoringPeriod,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from '@/features/actionAnalysis'
import {
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
  PAYMENT_TYPE_VALUES,
} from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import { useSyncedState } from '@/hooks'
import { Icons } from '@/lib/icons'
import {
  PAYMENT_HISTORY_FILTERS_DEFAULT,
  type PaymentHistoryBarState,
} from '../lib/paymentHistoryUrlState'
import type { ScopedUserIds } from '../lib/scope'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'
import { MultiCheckboxDropdown } from './MultiCheckboxDropdown'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

interface Props {
  value: PaymentHistoryBarState
  operators: OperatorUser[]
  onApply: (next: PaymentHistoryBarState) => void
  onClear: () => void
  userTimezone?: string | null
  scope?: ScopedUserIds
}

function ymdToDate(ymd: string | undefined): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function dateToYmd(d: Date | null): string | undefined {
  if (!d) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

  // Translated option lists for the three multi-select dropdowns.
  const methodOptions = useMemo(
    () =>
      PAYMENT_METHOD_VALUES.map((m) => ({
        value: m,
        label: t(`pages.actionAnalysis.filters.paymentMethods.${m}`, m),
      })),
    [t]
  )
  const statusOptions = useMemo(
    () =>
      PAYMENT_STATUS_VALUES.map((s) => ({
        value: s,
        label: t(`pages.actionAnalysis.filters.paymentStatuses.${s}`, s),
      })),
    [t]
  )
  const typeOptions = useMemo(
    () =>
      PAYMENT_TYPE_VALUES.map((tt) => ({
        value: tt,
        label: t(`pages.actionAnalysis.filters.paymentTypes.${tt}`, tt),
      })),
    [t]
  )

  const verifiedFrom = ymdToDate(draft.verifiedFromDate)
  const verifiedTo = ymdToDate(draft.verifiedToDate)
  const paymentFrom = ymdToDate(draft.paymentFromDate)
  const paymentTo = ymdToDate(draft.paymentToDate)

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
          <EmployeeFilterDropdown
            operators={operators}
            selectedIds={draft.employeeIds}
            onChange={(ids) => update({ employeeIds: ids })}
            disabled={scope?.employeePickerDisabled}
            disabledLabel={scopeLockedEmpLabel}
            label={t('pages.actionAnalysis.filters.operator', 'Operator')}
          />

          <MultiCheckboxDropdown<PaymentMethod>
            label={t('pages.actionAnalysis.filters.paymentMethod', 'Payment method')}
            options={methodOptions}
            selected={draft.paymentMethods}
            onChange={(next) => update({ paymentMethods: next })}
            allLabel={t('pages.actionAnalysis.filters.paymentMethods.all', 'All methods')}
          />

          <MultiCheckboxDropdown<PaymentStatus>
            label={t('pages.actionAnalysis.filters.status', 'Status')}
            options={statusOptions}
            selected={draft.statuses}
            onChange={(next) => update({ statuses: next })}
            allLabel={t('pages.actionAnalysis.filters.paymentStatuses.all', 'All')}
          />

          <MultiCheckboxDropdown<PaymentType>
            label={t('pages.actionAnalysis.filters.paymentType', 'Payment type')}
            options={typeOptions}
            selected={draft.paymentTypes}
            onChange={(next) => update({ paymentTypes: next })}
            allLabel={t('pages.actionAnalysis.filters.paymentTypes.all', 'All types')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.paymentCommentSearch', 'Payment comment')}
            </span>
            <Input
              type="text"
              className="h-[45px]"
              placeholder={t(
                'pages.actionAnalysis.filters.paymentCommentSearchPlaceholder',
                'Search in payment comments…'
              )}
              value={draft.paymentCommentSearch ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ paymentCommentSearch: v === '' ? undefined : v })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.amountMin', 'Min amount')}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              className="h-[45px]"
              placeholder={t('pages.actionAnalysis.filters.amountMinPlaceholder', '0.00')}
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
              placeholder={t('pages.actionAnalysis.filters.amountMaxPlaceholder', 'e.g. 1000')}
              value={draft.amountMax ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ amountMax: v === '' ? undefined : Number(v) })
              }}
            />
          </div>
        </div>

        {/* Independent secondary date range — Confirmed at (Payment.verified_at). */}
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white/60 p-4">
          <span className="text-dark-500 text-xs font-semibold tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
            {t('pages.actionAnalysis.filters.confirmedAtRangeHeading', 'Confirmed at')}
          </span>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.actionAnalysis.filters.confirmedAtFrom', 'From')}
              </span>
              <DateSelect
                value={verifiedFrom}
                onChange={({ value: v }) => update({ verifiedFromDate: dateToYmd(v) ?? undefined })}
                placeholder={t('pages.actionAnalysis.filters.selectStartDate', 'Select start date')}
                max={verifiedTo ?? undefined}
                format="yyyy-MM-dd"
                className="min-w-0 flex-1 [&_input]:h-[45px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.actionAnalysis.filters.confirmedAtTo', 'To')}
              </span>
              <DateSelect
                value={verifiedTo}
                onChange={({ value: v }) => update({ verifiedToDate: dateToYmd(v) ?? undefined })}
                placeholder={t('pages.actionAnalysis.filters.selectEndDate', 'Select end date')}
                min={verifiedFrom ?? undefined}
                format="yyyy-MM-dd"
                className="min-w-0 flex-1 [&_input]:h-[45px]"
              />
            </div>
          </div>
        </div>

        {/* Independent tertiary date range — Payment date (Payment.payment_date, DATE). */}
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white/60 p-4">
          <span className="text-dark-500 text-xs font-semibold tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
            {t('pages.actionAnalysis.filters.paymentDateRangeHeading', 'Payment date')}
          </span>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.actionAnalysis.filters.paymentDateFrom', 'From')}
              </span>
              <DateSelect
                value={paymentFrom}
                onChange={({ value: v }) => update({ paymentFromDate: dateToYmd(v) ?? undefined })}
                placeholder={t('pages.actionAnalysis.filters.selectStartDate', 'Select start date')}
                max={paymentTo ?? undefined}
                format="yyyy-MM-dd"
                className="min-w-0 flex-1 [&_input]:h-[45px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.actionAnalysis.filters.paymentDateTo', 'To')}
              </span>
              <DateSelect
                value={paymentTo}
                onChange={({ value: v }) => update({ paymentToDate: dateToYmd(v) ?? undefined })}
                placeholder={t('pages.actionAnalysis.filters.selectEndDate', 'Select end date')}
                min={paymentFrom ?? undefined}
                format="yyyy-MM-dd"
                className="min-w-0 flex-1 [&_input]:h-[45px]"
              />
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
