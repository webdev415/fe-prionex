import { useTranslation } from 'react-i18next'
import type { CallMonitoringFilters, CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

const PERIODS: CallMonitoringPeriod[] = ['today', 'yesterday', 'last_7d', 'last_30d', 'custom']

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

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

export type CallFiltersBarValue = Omit<
  CallMonitoringFilters,
  'from_datetime' | 'to_datetime'
> & {
  customFromDate?: string
  customToDate?: string
}

interface Props {
  filters: CallFiltersBarValue
  operators: OperatorUser[]
  onChange: (next: Partial<CallFiltersBarValue>) => void
}

export function CallFiltersBar({ filters, operators, onChange }: Props) {
  const { t } = useTranslation('common')

  const operatorsWithExt = operators.filter((o) => !!o.asterisk_extension)
  const selectedExt = filters.agent_extensions?.[0] ?? ''
  const period = filters.period ?? 'last_7d'
  const isCustom = period === 'custom'

  return (
    <div className={FILTER_SURFACE}>
      <div className="flex w-full flex-col gap-4 lg:gap-5">
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.operator', 'Operator')}
            </span>
            <Select
              value={selectedExt ? selectedExt : 'all'}
              onValueChange={(v) =>
                onChange({ agent_extensions: v === 'all' ? undefined : [v] })
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={t('pages.actionAnalysis.filters.allOperators', 'All operators')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.allOperators', 'All operators')}
                </SelectItem>
                {operatorsWithExt.map((op) => (
                  <SelectItem key={op.id} value={String(op.asterisk_extension ?? '')}>
                    {op.full_name} ({op.asterisk_extension})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.period', 'Period')}
            </span>
            <Select
              value={period}
              onValueChange={(v) => onChange({ period: v as CallMonitoringPeriod })}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`pages.actionAnalysis.filters.periods.${p}`, p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.actionAnalysis.filters.statuses.all', 'All')}</SelectItem>
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
              className="h-10"
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
              className="h-10"
              value={filters.max_duration ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ max_duration: v === '' ? undefined : Number(v) })
              }}
            />
          </div>
        </div>

        {isCustom && (
          <div className="grid w-full gap-3 border-t border-gray-200/80 pt-4 sm:grid-cols-2 lg:max-w-2xl lg:gap-4">
            <DateSelect
              label={t('pages.actionAnalysis.filters.dateFrom', 'From')}
              value={parseYmd(filters.customFromDate)}
              onChange={({ value }) =>
                onChange({ customFromDate: formatYmd(value) ?? '' })
              }
              placeholder={t('pages.actionAnalysis.filters.selectDate', 'Select date')}
              format="yyyy-MM-dd"
            />
            <DateSelect
              label={t('pages.actionAnalysis.filters.dateTo', 'To')}
              value={parseYmd(filters.customToDate)}
              onChange={({ value }) =>
                onChange({ customToDate: formatYmd(value) ?? '' })
              }
              placeholder={t('pages.actionAnalysis.filters.selectDate', 'Select date')}
              format="yyyy-MM-dd"
            />
          </div>
        )}
      </div>
    </div>
  )
}
