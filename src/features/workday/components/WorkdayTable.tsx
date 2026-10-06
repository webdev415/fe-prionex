/**
 * WorkdayTable Component
 *
 * «Робочий день з розривами» per-operator table (14 columns) on the shared
 * DataTable. One row = one operator active on the Kyiv day: when the day
 * started and ended, the working time, the breaks, and the operator's Card 145
 * call metrics for the selected calls window.
 *
 * Rows come in the SERVER's order (department, group with null last, name,
 * id) with no sorting UI. Department and group are COLUMNS from the API (the
 * operator's CURRENT placement), not Techno-Finance's per-department sections
 * — the same choice the operator-promises table made for the same sort.
 *
 * Red rows: `row.is_red`, decided by the server on unrounded seconds against
 * `meta.red_threshold_seconds` — never recomputed here from rounded minutes.
 * The mark is a ring (see `WORKDAY_RED_ROW_CLASS`) plus a screen-reader text
 * in the name cell, never a background.
 *
 * The whole row opens the breaks modal; the name is ALSO a real button, so
 * the modal is reachable from the keyboard (DataTable rows are not focusable).
 * The button carries no aria-label/title — its accessible name is the visible
 * text, and nothing personal goes into an attribute.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDurationHms } from '@/features/outboundCalls'
import type { WorkdayRow } from '../api/types'
import { EMPTY, formatClock, formatCount, formatHours, formatMinutes } from '../utils/format'

/**
 * The red row's mark: an inset ring in `error-500` (red in every theme), NOT a
 * background — DataTable paints its own zebra `bg-muted`/`bg-card` on every
 * row and a second `bg-*` appended through `rowClassName` loses to it by
 * stylesheet order (docs: lessons «Фронтенд», operator-promises highlight).
 * Two pixels, because a 1px red line reads as a table border.
 */
export const WORKDAY_RED_ROW_CLASS = 'ring-2 ring-inset ring-error-500'

/** Number of columns — the width every skeleton of this table must use. */
export const WORKDAY_COLUMN_COUNT = 14

export interface WorkdayTableProps {
  rows: WorkdayRow[]
  /** The answer's `timezone` — clock times are rendered in it (Kyiv). */
  timezone: string
  /** `meta.day_closed` — false marks the working time as «на зараз». */
  dayClosed: boolean
  emptyMessage: string
  onOpenOperator: (row: WorkdayRow) => void
}

type WorkdayTableRow = WorkdayRow & { id: number }

export function WorkdayTable({
  rows,
  timezone,
  dayClosed,
  emptyMessage,
  onOpenOperator,
}: WorkdayTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  // `user_id` is unique per answer (one row per operator).
  const data: WorkdayTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.user_id })),
    [rows]
  )

  const columns: Column<WorkdayTableRow>[] = useMemo(
    () => [
      {
        key: 'fio',
        header: t('pages.reports.workday.columns.operator'),
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
                // The row's own click opens the same modal; one open per click.
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
              // The ring is colour only; this is the same fact in words.
              <span className="sr-only" data-red="true">
                {t('pages.reports.workday.redRowLabel')}
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'department_name',
        header: t('pages.reports.workday.columns.department'),
        render: (row) => row.department_name || EMPTY,
      },
      {
        key: 'group_name',
        header: t('pages.reports.workday.columns.group'),
        render: (row) => row.group_name || EMPTY,
      },
      {
        key: 'first_event_at',
        header: t('pages.reports.workday.columns.start'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">
            {formatClock(row.first_event_at, language, timezone)}
          </span>
        ),
      },
      {
        key: 'last_event_at',
        header: t('pages.reports.workday.columns.end'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{formatClock(row.last_event_at, language, timezone)}</span>
        ),
      },
      {
        key: 'working_seconds',
        header: t('pages.reports.workday.columns.workingHours'),
        align: 'right',
        // `max(0, last − first − lunch)`: on a running day it is the time
        // SO FAR (lunch already deducted, clamped to 0) — hence «на зараз».
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatHours(row.working_seconds, language)}
            {!dayClosed && (
              <span className="text-muted-foreground ml-1 text-xs">
                {t('pages.reports.workday.soFar')}
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'breaks_count',
        header: t('pages.reports.workday.columns.breaksCount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.breaks_count, language)}</span>
        ),
      },
      {
        key: 'breaks_total_seconds',
        header: t('pages.reports.workday.columns.breaksTotal'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMinutes(row.breaks_total_seconds, language)}</span>
        ),
      },
      {
        key: 'max_break_seconds',
        header: t('pages.reports.workday.columns.maxBreak'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMinutes(row.max_break_seconds, language)}</span>
        ),
      },
      // Call metrics: `calls` is null in EVERY row when Card 145 did not
      // answer (`meta.calls_unavailable`) — each cell then reads «—», and the
      // tab says why above the table.
      {
        key: 'answer_count',
        header: t('pages.reports.workday.columns.callsCount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.calls?.answer_count, language)}</span>
        ),
      },
      {
        key: 'answer_duration_seconds',
        header: t('pages.reports.workday.columns.callsDuration'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">
            {formatDurationHms(row.calls?.answer_duration_seconds)}
          </span>
        ),
      },
      {
        key: 'quality_count',
        header: t('pages.reports.workday.columns.qualityCount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.calls?.quality_count, language)}</span>
        ),
      },
      {
        key: 'quality_duration_seconds',
        header: t('pages.reports.workday.columns.qualityDuration'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">
            {formatDurationHms(row.calls?.quality_duration_seconds)}
          </span>
        ),
      },
      {
        key: 'avg_duration_per_answered_seconds',
        header: t('pages.reports.workday.columns.callsAvg'),
        align: 'right',
        // Null when nothing connected — no average conversation, not zero.
        render: (row) => (
          <span className="tabular-nums">
            {formatDurationHms(row.calls?.avg_duration_per_answered_seconds)}
          </span>
        ),
      },
    ],
    [t, language, timezone, dayClosed, onOpenOperator]
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage={emptyMessage}
      className="w-full"
      onRowClick={onOpenOperator}
      // Dismissed operators are dimmed with `opacity` (theme-independent), and
      // red rows get the ring; both can apply at once.
      rowClassName={(row) =>
        [row.is_active ? '' : 'opacity-60', row.is_red ? WORKDAY_RED_ROW_CLASS : '']
          .filter(Boolean)
          .join(' ') || undefined
      }
    />
  )
}
