import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useSyncedState } from '@/hooks'
import { Icons } from '@/lib/icons'
import { ANALYTICS_BAR_DEFAULT, type AnalyticsBarState } from '../lib/analyticsUrlState'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'
import type { AnalyticsPeriod } from '@/features/operatorAnalytics'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

interface Props<S extends AnalyticsBarState> {
  value: S
  operators: OperatorUser[]
  onApply: (next: S) => void
  onClear: () => void
  userTimezone?: string | null
  trailing?: React.ReactNode
}

export function AnalyticsFiltersBar<S extends AnalyticsBarState>({
  value,
  operators,
  onApply,
  onClear,
  userTimezone,
  trailing,
}: Props<S>) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useSyncedState<S>(value, value)

  const update = (patch: Partial<S>) => {
    setDraft((prev) => {
      const merged = { ...prev, ...patch } as S
      if (merged.period !== 'custom') {
        merged.customFromDate = undefined
        merged.customToDate = undefined
      }
      return merged
    })
  }

  const period: AnalyticsPeriod = draft.period ?? 'last_7d'

  const selectedIds = useMemo(() => draft.operator_ids ?? [], [draft.operator_ids])

  const handleOperatorsChange = (ids: number[]) => {
    update({ operator_ids: ids.length ? ids : undefined } as Partial<S>)
  }

  const handleApply = () => onApply(draft)
  const handleClear = () => {
    setDraft({ ...ANALYTICS_BAR_DEFAULT } as S)
    onClear()
  }

  return (
    <div className={FILTER_SURFACE}>
      <div className="flex w-full flex-col gap-4 sm:gap-6">
        <DateRangeQuickFilter
          period={period}
          customFromDate={draft.customFromDate}
          customToDate={draft.customToDate}
          onChange={(next) => update(next as Partial<S>)}
          userTimezone={userTimezone}
        />

        <div className="h-px w-full bg-gray-200" />

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <EmployeeFilterDropdown
            operators={operators}
            selectedIds={selectedIds}
            onChange={handleOperatorsChange}
            label={t('pages.training.filters.employee', 'Employee')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.period', 'Period')}
            </span>
            <Select
              value={period}
              onValueChange={(v) => update({ period: v as AnalyticsPeriod } as Partial<S>)}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">
                  {t('pages.training.filters.periods.today', 'Today')}
                </SelectItem>
                <SelectItem value="yesterday">
                  {t('pages.training.filters.periods.yesterday', 'Yesterday')}
                </SelectItem>
                <SelectItem value="last_7d">
                  {t('pages.training.filters.periods.last7d', 'Last 7 days')}
                </SelectItem>
                <SelectItem value="last_30d">
                  {t('pages.training.filters.periods.last30d', 'Last 30 days')}
                </SelectItem>
                <SelectItem value="custom">
                  {t('pages.training.filters.periods.custom', 'Custom')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {trailing ? <div>{trailing}</div> : null}
        </div>

        <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="white-secondary"
            onClick={handleClear}
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
