/**
 * WorkmonthDaysModal Component
 *
 * The month modal of «Робочий місяць з розривами»
 * (`GET /workmonth/{user_id}/days`): every calendar day of the month for one
 * operator, with its flags — weekend, holiday, no activity, outside the
 * window — and the day's figures. The totals strip shows the SAME numbers as
 * the operator's row in the month table.
 *
 * Days outside the window (today and later; before the history start) are
 * HIDDEN by default — Techno-Finance shows only `[1st .. yesterday]` — and a
 * switch shows them (decision 06.10.2026: the API sends the whole month, the
 * frontend hides). Their figures are null and render «—».
 *
 * 🔴 The operator's name in the heading is personal data: it is rendered only
 * as text inside `data-openreplay-obscured` (owner decision 06.10.2026) and
 * never in an attribute. The day rows carry no call labels.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { piiProps } from '@/lib/openreplay/pii'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import type { WorkmonthDay } from '../api/types'
import { useWorkmonthDays } from '../hooks'
import {
  EMPTY,
  formatCalendarDay,
  formatClock,
  formatCount,
  formatHours,
  formatMinutes,
  formatMonthLabel,
  formatWeekdayShort,
} from '../utils/format'
import { WorkdayErrorState } from './WorkdayErrorState'
import { WORKDAY_RED_ROW_CLASS } from './WorkdayTable'

export interface WorkmonthDaysModalProps {
  projectId: number
  operator: { user_id: number; fio: string } | null
  month: string
  requestTimezone?: string | null
  onClose: () => void
}

type DayRow = WorkmonthDay & { id: string }

/** The day's flags, as text (never colour alone). */
function dayFlags(day: WorkmonthDay): Array<'weekend' | 'holiday' | 'noActivity' | 'outOfWindow'> {
  const flags: Array<'weekend' | 'holiday' | 'noActivity' | 'outOfWindow'> = []
  if (day.is_weekend) flags.push('weekend')
  if (day.is_holiday) flags.push('holiday')
  if (!day.in_window) flags.push('outOfWindow')
  else if (!day.has_activity) flags.push('noActivity')
  return flags
}

export function WorkmonthDaysModal({
  projectId,
  operator,
  month,
  requestTimezone,
  onClose,
}: WorkmonthDaysModalProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  const [showOutOfWindow, setShowOutOfWindow] = useState(false)
  const query = useWorkmonthDays({
    projectId,
    userId: operator?.user_id ?? null,
    month,
    timezone: requestTimezone,
  })
  const data = query.data
  const timezone = data?.timezone ?? null

  const allDays = useMemo(() => data?.days ?? [], [data])
  const outOfWindowCount = allDays.filter((day) => !day.in_window).length
  const rows: DayRow[] = useMemo(
    () =>
      allDays
        .filter((day) => showOutOfWindow || day.in_window)
        .map((day) => ({ ...day, id: day.day })),
    [allDays, showOutOfWindow]
  )

  const columns: Column<DayRow>[] = useMemo(
    () => [
      {
        key: 'day',
        header: t('pages.reports.workmonth.days.columns.date'),
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatCalendarDay(row.day, language)}{' '}
            <span className="text-muted-foreground">{formatWeekdayShort(row.day, language)}</span>
          </span>
        ),
      },
      {
        key: 'flags',
        header: t('pages.reports.workmonth.days.columns.flags'),
        render: (row) => {
          const flags = dayFlags(row)
          return flags.length === 0 ? (
            ''
          ) : (
            <span className="inline-flex flex-wrap gap-1" data-flags={flags.join(' ')}>
              {flags.map((flag) => (
                <span
                  key={flag}
                  className="border-border text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap"
                >
                  {t(`pages.reports.workmonth.days.flags.${flag}`)}
                </span>
              ))}
            </span>
          )
        },
      },
      {
        key: 'first_event_at',
        header: t('pages.reports.workmonth.days.columns.start'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">
            {formatClock(row.first_event_at, language, timezone)}
          </span>
        ),
      },
      {
        key: 'last_event_at',
        header: t('pages.reports.workmonth.days.columns.end'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{formatClock(row.last_event_at, language, timezone)}</span>
        ),
      },
      {
        key: 'working_seconds',
        header: t('pages.reports.workmonth.days.columns.workingHours'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatHours(row.working_seconds, language)}</span>
        ),
      },
      {
        key: 'breaks_count',
        header: t('pages.reports.workmonth.days.columns.breaksCount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.breaks_count, language)}</span>
        ),
      },
      {
        key: 'breaks_total_seconds',
        header: t('pages.reports.workmonth.days.columns.breaksTotal'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMinutes(row.breaks_total_seconds, language)}</span>
        ),
      },
      {
        key: 'max_break_seconds',
        header: t('pages.reports.workmonth.days.columns.maxBreak'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMinutes(row.max_break_seconds, language)}</span>
        ),
      },
    ],
    [t, language, timezone]
  )

  const totals = data?.totals

  return (
    <Modal open={operator !== null} onClose={onClose} maxWidth="3xl">
      <ModalHeader
        title={
          <span className="flex flex-col">
            {/* The name is masked in session recordings (text only, never an attribute). */}
            <span {...piiProps}>{operator?.fio}</span>
            <span className="text-muted-foreground text-sm font-normal">
              {t('pages.reports.workmonth.days.title', {
                month: formatMonthLabel(month, language),
              })}
            </span>
          </span>
        }
      />
      <ModalContent>
        {query.isLoading ? (
          <TableSkeleton columns={8} rows={6} />
        ) : query.isError ? (
          <WorkdayErrorState error={query.error} tab="workmonth" onRetry={() => query.refetch()} />
        ) : data && totals ? (
          <div className="flex flex-col gap-4" data-testid="workmonth-days">
            <dl
              className={`border-border grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 text-sm sm:grid-cols-4 ${totals.is_red ? WORKDAY_RED_ROW_CLASS : ''}`}
            >
              <Stat
                label={t('pages.reports.workmonth.columns.workingHours')}
                value={formatHours(totals.total_working_seconds, language)}
              />
              <Stat
                label={t('pages.reports.workmonth.columns.breaksTotal')}
                value={formatMinutes(totals.total_breaks_seconds, language)}
              />
              <Stat
                label={t('pages.reports.workmonth.columns.daysWithActivity')}
                value={formatCount(totals.days_with_activity, language)}
              />
              <Stat
                label={t('pages.reports.workmonth.columns.average')}
                value={formatMinutes(totals.average_breaks_seconds, language)}
              />
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                {t('pages.reports.workday.timezoneHint')}
                {` ${t('pages.reports.workmonth.days.totalsHint')}`}
              </p>
              {outOfWindowCount > 0 && (
                <label className="text-foreground flex items-center gap-2 text-xs">
                  <ToggleSwitch
                    checked={showOutOfWindow}
                    onChange={setShowOutOfWindow}
                    ariaLabel={t('pages.reports.workmonth.days.showOutOfWindow')}
                  />
                  <span>
                    {t('pages.reports.workmonth.days.showOutOfWindow')} ({outOfWindowCount})
                  </span>
                </label>
              )}
            </div>
            <DataTable
              columns={columns}
              data={rows}
              className="w-full"
              emptyMessage={t('pages.reports.workmonth.days.empty')}
              rowClassName={(row) =>
                [
                  // Days that do not count toward the totals (weekend, holiday
                  // when excluded, outside the window) are dimmed — with
                  // `opacity`, which is theme-independent; the flag text says why.
                  row.counts_in_totals ? '' : 'opacity-70',
                  row.is_red ? WORKDAY_RED_ROW_CLASS : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
            />
          </div>
        ) : null}
      </ModalContent>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground tabular-nums">{value || EMPTY}</dd>
    </div>
  )
}
