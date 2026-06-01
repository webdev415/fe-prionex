import { useTranslation } from 'react-i18next'
import { DateSelect } from '@/components/ui/DateSelect'
import { cn } from '@/lib/utils'
import type { CallMonitoringPeriod } from '@/features/training'
import { defaultCustomDateRange } from '../lib/dateRange'

interface DateRangeQuickFilterProps {
  period: CallMonitoringPeriod
  customFromDate?: string
  customToDate?: string
  onChange: (next: {
    period?: CallMonitoringPeriod
    customFromDate?: string
    customToDate?: string
  }) => void
  userTimezone?: string | null
}

const QUICK_RANGES: Array<{ id: CallMonitoringPeriod; key: string; fallback: string }> = [
  { id: 'today', key: 'pages.training.filters.periods.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.filters.periods.yesterday', fallback: 'Yesterday' },
  { id: 'last_7d', key: 'pages.training.filters.periods.last_7d', fallback: 'Last 7 days' },
  {
    id: 'last_30d',
    key: 'pages.training.filters.periods.last_30d',
    fallback: 'Last 30 days',
  },
]

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

export function DateRangeQuickFilter({
  period,
  customFromDate,
  customToDate,
  onChange,
  userTimezone,
}: DateRangeQuickFilterProps) {
  const { t } = useTranslation('common')

  const handleQuickRange = (id: CallMonitoringPeriod) => {
    onChange({ period: id, customFromDate: undefined, customToDate: undefined })
  }

  const handleDateChange = (which: 'from' | 'to', date: Date | null) => {
    const ymd = formatYmd(date)
    const fallback = defaultCustomDateRange(userTimezone)
    if (which === 'from') {
      onChange({
        period: 'custom',
        customFromDate: ymd ?? fallback.from,
        customToDate: customToDate ?? fallback.to,
      })
    } else {
      onChange({
        period: 'custom',
        customFromDate: customFromDate ?? fallback.from,
        customToDate: ymd ?? fallback.to,
      })
    }
  }

  const fromValue = parseYmd(customFromDate)
  const toValue = parseYmd(customToDate)

  return (
    <div className="flex flex-col gap-4 self-stretch xl:flex-row xl:items-center xl:gap-10">
      <div className="flex flex-1 flex-col gap-2 self-stretch sm:items-end sm:gap-5">
        <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3">
          <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
            {t('pages.training.filters.dateRange', 'Date Range')}:
          </span>
          <div className="flex flex-1 items-center gap-2">
            <DateSelect
              value={fromValue}
              onChange={({ value }) => handleDateChange('from', value)}
              placeholder={t('pages.training.filters.selectStartDate', 'Select start date')}
              max={toValue ?? undefined}
              allowManualInput
              format="dd.MM.yyyy"
              className="flex-1 [&_input]:h-9 [&_input]:text-xs"
            />
            <span className="text-base leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
              -
            </span>
            <DateSelect
              value={toValue}
              onChange={({ value }) => handleDateChange('to', value)}
              placeholder={t('pages.training.filters.selectEndDate', 'Select end date')}
              min={fromValue ?? undefined}
              allowManualInput
              format="dd.MM.yyyy"
              className="flex-1 [&_input]:h-9 [&_input]:text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3 xl:flex-1">
        <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
          {t('pages.training.filters.quickRanges', 'Quick')}:
        </span>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:items-center sm:gap-2">
          {QUICK_RANGES.map((qr) => {
            const active = period === qr.id
            return (
              <button
                key={qr.id}
                type="button"
                onClick={() => handleQuickRange(qr.id)}
                className={cn(
                  'text-dark-500 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm sm:flex-1 sm:px-4',
                  active ? 'bg-primary-500 text-white' : 'hover:bg-gray-50'
                )}
              >
                {t(qr.key, qr.fallback)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
