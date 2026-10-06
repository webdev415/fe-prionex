/**
 * WorkmonthTable Component
 *
 * «Робочий місяць з розривами» per-operator table (9 columns): the month's
 * totals over the days that COUNT (weekdays, minus holidays when the project
 * excludes them), the number of such days with activity, and the average
 * break time per active day.
 *
 * Server order, no sorting UI; department and group from the API. Red rows:
 * `row.is_red` — the AVERAGE break per active day above
 * `meta.red_threshold_seconds` (Techno-Finance parity, decision 06.10.2026),
 * decided by the server; the same ring as the day table. An operator who
 * worked only on a weekend has a zero row and an average of «—» (null), not
 * 0 — 0 would read as a model operator.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type { WorkmonthRow } from '../api/types'
import { EMPTY, formatCount, formatHours, formatMinutes } from '../utils/format'
import { WORKDAY_RED_ROW_CLASS } from './WorkdayTable'

/** Number of columns — the width every skeleton of this table must use. */
export const WORKMONTH_COLUMN_COUNT = 9

export interface WorkmonthTableProps {
  rows: WorkmonthRow[]
  emptyMessage: string
  onOpenOperator: (row: WorkmonthRow) => void
}

type WorkmonthTableRow = WorkmonthRow & { id: number }

export function WorkmonthTable({ rows, emptyMessage, onOpenOperator }: WorkmonthTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: WorkmonthTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.user_id })),
    [rows]
  )

  const columns: Column<WorkmonthTableRow>[] = useMemo(
    () => [
      {
        key: 'fio',
        header: t('pages.reports.workmonth.columns.operator'),
        // 🔴 The operator's name is personal data: the whole cell is masked in
        // session recordings (the attribute lands on the <td> and inherits to
        // the button, the badge and the screen-reader text). The button's
        // accessible name is its visible text — no aria-label/title.
        obscured: true,
        render: (row) => (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <button
              type="button"
              className="text-foreground text-left hover:underline focus-visible:underline"
              onClick={(event) => {
                event.stopPropagation()
                onOpenOperator(row)
              }}
            >
              {row.fio}
            </button>
            {!row.is_active && (
              <span className="border-border text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
                {t('pages.reports.workday.inactiveBadge')}
              </span>
            )}
            {row.is_red && (
              <span className="sr-only" data-red="true">
                {t('pages.reports.workmonth.redRowLabel')}
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'department_name',
        header: t('pages.reports.workmonth.columns.department'),
        render: (row) => row.department_name || EMPTY,
      },
      {
        key: 'group_name',
        header: t('pages.reports.workmonth.columns.group'),
        render: (row) => row.group_name || EMPTY,
      },
      {
        key: 'total_working_seconds',
        header: t('pages.reports.workmonth.columns.workingHours'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatHours(row.total_working_seconds, language)}</span>
        ),
      },
      {
        key: 'total_breaks_count',
        header: t('pages.reports.workmonth.columns.breaksCount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.total_breaks_count, language)}</span>
        ),
      },
      {
        key: 'total_breaks_seconds',
        header: t('pages.reports.workmonth.columns.breaksTotal'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMinutes(row.total_breaks_seconds, language)}</span>
        ),
      },
      {
        key: 'max_break_seconds',
        header: t('pages.reports.workmonth.columns.maxBreak'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMinutes(row.max_break_seconds, language)}</span>
        ),
      },
      {
        key: 'days_with_activity',
        header: t('pages.reports.workmonth.columns.daysWithActivity'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.days_with_activity, language)}</span>
        ),
      },
      {
        key: 'average_breaks_seconds',
        header: t('pages.reports.workmonth.columns.average'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">
            {formatMinutes(row.average_breaks_seconds, language)}
          </span>
        ),
      },
    ],
    [t, language, onOpenOperator]
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage={emptyMessage}
      className="w-full"
      onRowClick={onOpenOperator}
      rowClassName={(row) =>
        [row.is_active ? '' : 'opacity-60', row.is_red ? WORKDAY_RED_ROW_CLASS : '']
          .filter(Boolean)
          .join(' ') || undefined
      }
    />
  )
}
