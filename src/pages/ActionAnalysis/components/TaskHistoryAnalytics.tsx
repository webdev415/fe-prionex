import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TaskHistoryAnalyticsBucket } from '@/features/actionAnalysis'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

interface Props {
  buckets: TaskHistoryAnalyticsBucket[]
  total: number
  isLoading?: boolean
  /** Optional override for tests. Defaults to the current month. */
  initialViewMonth?: Date
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 6-week (42-day) Monday-first grid covering the visible month. Fixed
 * height keeps the analytics block from jumping when the user navigates
 * between months that span different week counts. */
function buildMonthGrid(viewMonth: Date): Date[] {
  const firstOfMonth = startOfMonth(viewMonth)
  // JS getDay(): 0=Sun .. 6=Sat. Convert to Monday-first: Mon=0 .. Sun=6.
  const mondayIndex = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - mondayIndex)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

/** Heat tiering. v1 uses fixed thresholds — simple to reason about and
 * caps the worst-case color at the project's primary scale. */
function tierClasses(count: number, inMonth: boolean): string {
  if (!inMonth) return 'bg-muted text-muted-foreground'
  if (count === 0) return 'bg-card text-muted-foreground border border-border'
  if (count <= 2) return 'bg-primary-100 text-primary-900'
  if (count <= 5) return 'bg-primary-300 text-primary-900'
  if (count <= 10) return 'bg-primary-500 text-primary-foreground'
  return 'bg-primary-700 text-primary-foreground'
}

export function TaskHistoryAnalytics({ buckets, total, isLoading, initialViewMonth }: Props) {
  const { t, i18n } = useTranslation('common')

  const [viewMonth, setViewMonth] = useState<Date>(
    () => initialViewMonth ?? startOfMonth(new Date())
  )

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])

  const bucketsByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of buckets) m.set(b.date, b.count)
    return m
  }, [buckets])

  const visibleMonthHasBuckets = useMemo(() => {
    const y = viewMonth.getFullYear()
    const m = viewMonth.getMonth()
    for (const b of buckets) {
      const parts = b.date.split('-')
      if (Number(parts[0]) === y && Number(parts[1]) - 1 === m && b.count > 0) {
        return true
      }
    }
    return false
  }, [buckets, viewMonth])

  const today = new Date()
  const monthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language || 'en', {
        month: 'long',
        year: 'numeric',
      }).format(viewMonth)
    } catch {
      return `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}`
    }
  }, [viewMonth, i18n.language])

  return (
    <div className="bg-card/50 rounded-xl p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-medium sm:text-base">
            {t('pages.actionAnalysis.taskHistoryAnalytics.title', 'Tasks due by date')}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t(
              'pages.actionAnalysis.taskHistoryAnalytics.subtitle',
              'Total tasks due within the current filter range.'
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-foreground text-2xl leading-none font-light">
            {isLoading ? '…' : total.toLocaleString()}
          </div>
          <div className="text-muted-foreground mt-1 text-[11px] tracking-wide uppercase">
            {t('pages.actionAnalysis.taskHistoryAnalytics.totalLabel', 'tasks due')}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('pages.actionAnalysis.taskHistoryAnalytics.prevMonth', 'Previous month')}
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            className="hover:border-primary-300 border-border text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-full border"
          >
            <Icons.ArrowLeft size={16} />
          </button>
          <span className="text-foreground text-sm font-medium capitalize">{monthLabel}</span>
          <button
            type="button"
            aria-label={t('pages.actionAnalysis.taskHistoryAnalytics.nextMonth', 'Next month')}
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="hover:border-primary-300 border-border text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-full border"
          >
            <Icons.ArrowRight size={16} />
          </button>
        </div>
        <Button
          type="button"
          variant="white-secondary"
          onClick={() => setViewMonth(startOfMonth(new Date()))}
          className="h-8 rounded-full px-3 text-xs"
        >
          {t('pages.actionAnalysis.taskHistoryAnalytics.today', 'Today')}
        </Button>
      </div>

      <div className={`mt-4 ${isLoading ? 'opacity-50' : ''}`}>
        <div
          className="text-muted-foreground grid grid-cols-7 gap-1 text-[11px] font-medium uppercase"
          role="row"
        >
          {WEEKDAY_KEYS.map((key) => (
            <div key={key} className="px-1 py-1 text-center">
              {t(
                `pages.actionAnalysis.taskHistoryAnalytics.weekdayShort.${key}`,
                key.charAt(0).toUpperCase() + key.slice(1)
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1" role="grid">
          {grid.map((day) => {
            const inMonth = day.getMonth() === viewMonth.getMonth()
            const ymd = formatYmd(day)
            const count = bucketsByDate.get(ymd) ?? 0
            const isToday = isSameDay(day, today)
            const cls = tierClasses(count, inMonth)
            const ringCls = isToday ? 'ring-2 ring-primary-500 ring-offset-1' : ''
            return (
              <div
                key={ymd}
                role="gridcell"
                aria-label={`${ymd}: ${count}`}
                title={`${ymd}: ${count}`}
                data-date={ymd}
                data-in-month={inMonth ? 'true' : 'false'}
                className={`relative flex aspect-square min-h-[44px] flex-col rounded p-1 text-xs ${cls} ${ringCls}`}
              >
                <span className="leading-none">{day.getDate()}</span>
                {inMonth && count > 0 ? (
                  <span className="mt-auto self-center text-base leading-none font-semibold">
                    {count}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        {!isLoading && !visibleMonthHasBuckets ? (
          <div className="border-border bg-muted text-muted-foreground mt-3 rounded-md border border-dashed px-3 py-3 text-center text-xs">
            {t('pages.actionAnalysis.taskHistoryAnalytics.emptyMonth', 'No tasks due this month.')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
