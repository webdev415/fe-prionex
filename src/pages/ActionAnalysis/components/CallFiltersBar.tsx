import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CallMonitoringFilters, CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

export type CallFiltersBarValue = Omit<CallMonitoringFilters, 'from_datetime' | 'to_datetime'> & {
  customFromDate?: string
  customToDate?: string
}

interface Props {
  filters: CallFiltersBarValue
  operators: OperatorUser[]
  onChange: (next: Partial<CallFiltersBarValue>) => void
  userTimezone?: string | null
}

export function CallFiltersBar({ filters, operators, onChange, userTimezone }: Props) {
  const { t } = useTranslation('common')

  const operatorsWithExt = useMemo(
    () => operators.filter((o) => !!o.asterisk_extension),
    [operators]
  )

  const selectedOperatorIds = useMemo(() => {
    const exts = filters.agent_extensions ?? []
    return operatorsWithExt
      .filter((o) => exts.includes(o.asterisk_extension as string))
      .map((o) => o.id)
  }, [operatorsWithExt, filters.agent_extensions])

  const period = filters.period ?? 'last_7d'

  const handleOperatorsChange = (ids: number[]) => {
    if (ids.length === 0) {
      onChange({ agent_extensions: undefined })
      return
    }
    const exts = ids
      .map((id) => operatorsWithExt.find((o) => o.id === id)?.asterisk_extension)
      .filter((e): e is string => !!e)
    onChange({ agent_extensions: exts.length ? exts : undefined })
  }

  return (
    <div className={FILTER_SURFACE}>
      <div className="flex w-full flex-col gap-4 sm:gap-6">
        <DateRangeQuickFilter
          period={period}
          customFromDate={filters.customFromDate}
          customToDate={filters.customToDate}
          onChange={(next) => onChange(next)}
          userTimezone={userTimezone}
        />

        <div className="h-px w-full bg-gray-200" />

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <EmployeeFilterDropdown
            operators={operatorsWithExt}
            selectedIds={selectedOperatorIds}
            onChange={handleOperatorsChange}
            label={t('pages.actionAnalysis.filters.operator', 'Operator')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.status', 'Status')}
            </span>
            <Select
              value={filters.outcome_filter ?? 'all'}
              onValueChange={(v) =>
                onChange({
                  outcome_filter: v as CallMonitoringFilters['outcome_filter'],
                })
              }
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.statuses.all', 'All')}
                </SelectItem>
                <SelectItem value="answered">
                  {t('pages.actionAnalysis.filters.statuses.answered', 'Answered')}
                </SelectItem>
                <SelectItem value="not_answered">
                  {t('pages.actionAnalysis.filters.statuses.notAnswered', 'Not answered')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.minDuration', 'Min duration (s)')}
            </span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-[45px]"
              placeholder={t('pages.actionAnalysis.filters.minDurationPlaceholder', 'e.g. 30')}
              value={filters.min_duration ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ min_duration: v === '' ? undefined : Number(v) })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.maxDuration', 'Max duration (s)')}
            </span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-[45px]"
              placeholder={t('pages.actionAnalysis.filters.maxDurationPlaceholder', 'e.g. 600')}
              value={filters.max_duration ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ max_duration: v === '' ? undefined : Number(v) })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Keep `CallMonitoringPeriod` re-exported for callers that already import the type from this module.
export type { CallMonitoringPeriod }
