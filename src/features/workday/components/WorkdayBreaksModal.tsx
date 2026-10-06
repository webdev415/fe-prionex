/**
 * WorkdayBreaksModal Component
 *
 * The day modal of «Робочий день з розривами»: one operator's breaks on the
 * Kyiv day (`GET /workday/{user_id}/breaks`), each with the event that ended
 * the activity before it and the one that resumed it.
 *
 * 🔴 PERSONAL DATA. A `call` event's label is «outbound → <customer phone>:
 * answered» (decision 02.10.2026: shown as in Techno-Finance, masked for
 * session recording). Both event columns are therefore `Column.obscured` —
 * the attribute lands on the `<td>` and inherits down to the label text — and
 * a label is never put into `title`, `aria-label` or a tooltip. The portal is
 * not a problem: the attribute sits on the cells themselves, inside it.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { piiProps } from '@/lib/openreplay/pii'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import type { WorkdayBreak, WorkdayBreakEvent } from '../api/types'
import { useWorkdayBreaks } from '../hooks'
import {
  EMPTY,
  formatCalendarDay,
  formatClock,
  formatCount,
  formatHours,
  formatMinutes,
  secondsToMinutes,
} from '../utils/format'
import { WorkdayErrorState } from './WorkdayErrorState'
import { WORKDAY_RED_ROW_CLASS } from './WorkdayTable'

export interface WorkdayBreaksModalProps {
  projectId: number
  /** The operator whose row was clicked; null = closed. */
  operator: { user_id: number; fio: string } | null
  day: string
  /** Profile timezone, sent like every sibling request (validated, moves nothing). */
  requestTimezone?: string | null
  onClose: () => void
}

type BreakRow = WorkdayBreak & { id: string }

export function WorkdayBreaksModal({
  projectId,
  operator,
  day,
  requestTimezone,
  onClose,
}: WorkdayBreaksModalProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  const query = useWorkdayBreaks({
    projectId,
    userId: operator?.user_id ?? null,
    day,
    timezone: requestTimezone,
  })
  const data = query.data
  const timezone = data?.timezone ?? null

  const rows: BreakRow[] = useMemo(
    () => (data?.breaks ?? []).map((item, index) => ({ ...item, id: `${item.start_at}-${index}` })),
    [data]
  )

  const columns: Column<BreakRow>[] = useMemo(() => {
    const sourceLabel = (event: WorkdayBreakEvent) =>
      t(`pages.reports.workday.sources.${event.source}`, { defaultValue: event.source })
    return [
      {
        key: 'start_at',
        header: t('pages.reports.workday.breaks.columns.start'),
        render: (row) => (
          <span className="tabular-nums">{formatClock(row.start_at, language, timezone)}</span>
        ),
      },
      {
        key: 'end_at',
        header: t('pages.reports.workday.breaks.columns.end'),
        render: (row) => (
          <span className="tabular-nums">{formatClock(row.end_at, language, timezone)}</span>
        ),
      },
      {
        key: 'duration_seconds',
        header: t('pages.reports.workday.breaks.columns.duration'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMinutes(row.duration_seconds, language)}</span>
        ),
      },
      {
        key: 'before',
        header: t('pages.reports.workday.breaks.columns.before'),
        // A call label carries the customer's phone — see the docstring.
        obscured: true,
        render: (row) => <EventCell source={sourceLabel(row.before)} label={row.before.label} />,
      },
      {
        key: 'after',
        header: t('pages.reports.workday.breaks.columns.after'),
        obscured: true,
        render: (row) => <EventCell source={sourceLabel(row.after)} label={row.after.label} />,
      },
    ]
  }, [t, language, timezone])

  const breakThresholdMinutes = secondsToMinutes(data?.meta.break_threshold_seconds)
  const hasActivity = !!data?.first_event_at

  return (
    <Modal open={operator !== null} onClose={onClose} maxWidth="3xl">
      <ModalHeader
        title={
          <span className="flex flex-col">
            {/* The name is masked in session recordings (text only, never an attribute). */}
            <span {...piiProps}>{operator?.fio}</span>
            <span className="text-muted-foreground text-sm font-normal">
              {t('pages.reports.workday.breaks.title', {
                date: formatCalendarDay(day, language),
              })}
            </span>
          </span>
        }
      />
      <ModalContent>
        {query.isLoading ? (
          <TableSkeleton columns={5} rows={4} />
        ) : query.isError ? (
          <WorkdayErrorState error={query.error} tab="workday" onRetry={() => query.refetch()} />
        ) : data ? (
          <div className="flex flex-col gap-4" data-testid="workday-breaks">
            <dl
              className={`border-border grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 text-sm sm:grid-cols-4 ${data.is_red ? WORKDAY_RED_ROW_CLASS : ''}`}
            >
              <Stat
                label={t('pages.reports.workday.columns.department')}
                value={[data.department_name, data.group_name].filter(Boolean).join(' · ') || EMPTY}
              />
              <Stat
                label={t('pages.reports.workday.breaks.dayRange')}
                value={`${formatClock(data.first_event_at, language, timezone)} – ${formatClock(data.last_event_at, language, timezone)}`}
              />
              <Stat
                label={t('pages.reports.workday.columns.workingHours')}
                value={
                  data.meta.day_closed
                    ? formatHours(data.working_seconds, language)
                    : `${formatHours(data.working_seconds, language)} ${t('pages.reports.workday.soFar')}`
                }
              />
              <Stat
                label={t('pages.reports.workday.breaks.summary')}
                value={t('pages.reports.workday.breaks.summaryValue', {
                  breaks: formatCount(data.breaks_count, language),
                  total: formatMinutes(data.breaks_total_seconds, language),
                  max: formatMinutes(data.max_break_seconds, language),
                })}
              />
            </dl>
            <p className="text-muted-foreground text-xs">
              {t('pages.reports.workday.timezoneHint')}
              {data.breaks.length > 1 && ` ${t('pages.reports.workday.breaks.roundingHint')}`}
            </p>
            {hasActivity ? (
              <DataTable
                columns={columns}
                data={rows}
                className="w-full"
                emptyMessage={t('pages.reports.workday.breaks.noBreaks', {
                  minutes: breakThresholdMinutes ?? EMPTY,
                })}
              />
            ) : (
              <p className="text-muted-foreground text-center text-sm">
                {t('pages.reports.workday.breaks.noActivity')}
              </p>
            )}
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
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

/** Source tag + the TF label. Rendered inside an obscured cell — text only. */
function EventCell({ source, label }: { source: string; label: string }) {
  return (
    <span className="inline-flex items-start gap-2">
      <span className="border-border text-muted-foreground shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
        {source}
      </span>
      <span className="break-words">{label || EMPTY}</span>
    </span>
  )
}
