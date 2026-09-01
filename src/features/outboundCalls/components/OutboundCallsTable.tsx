/**
 * OutboundCallsTable Component
 *
 * «Вихідні дзвінки» per-seat table (14 columns) built on the shared DataTable.
 * One row = one OPERATOR SEAT: how many outbound calls were dialled from it,
 * how many reached a person, how many of those lasted long enough to count,
 * and how long the operator actually talked.
 *
 * Rows are rendered in the SERVER's order (`full_count` descending, then
 * `fio`, then `sip`, with the seats the directory does not know last) and
 * there is deliberately no sorting UI — the order is part of the contract,
 * Card 145 parity plus the tie-break the card lacks.
 *
 * `user_id` is NOT a column: it exists in the payload so a consumer can join
 * on something stabler than a name, which is a machine's concern.
 *
 * The four duration columns are rendered from whole seconds by
 * `formatDurationHms` — see utils/format.ts for why nothing here goes through
 * `Date`.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type { OutboundCallsReportRow } from '../types'
import {
  formatCount,
  formatDurationHms,
  formatPercent,
  operatorLabel,
  orgLabel,
} from '../utils/format'

export interface OutboundCallsTableProps {
  rows: OutboundCallsReportRow[]
  /** Shown in the table body when the window legitimately produced no calls. */
  emptyMessage: string
}

/**
 * DataTable requires an `id`. `sip` is the row's key server-side — the
 * directory holds at most one account per extension and the aggregate groups
 * by it — while `user_id` is null for an unknown seat, so it cannot key rows.
 * The position is appended for robustness to a contract change, not for a live
 * bug: were the aggregate ever to group by something else, two rows sharing an
 * extension would otherwise collide into one React key.
 */
type OutboundCallsTableRow = OutboundCallsReportRow & { id: string }

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (OutboundCallsTab), so nobody counts the list by hand a second time. It
 * cannot be derived from `columns` at module scope: that array is built inside
 * the component because every header goes through `t`. The pair is kept honest
 * by a test asserting the rendered header count equals this constant.
 */
export const OUTBOUND_CALLS_COLUMN_COUNT = 14

export function OutboundCallsTable({ rows, emptyMessage }: OutboundCallsTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: OutboundCallsTableRow[] = useMemo(
    () => rows.map((row, index) => ({ ...row, id: `${row.sip}-${index}` })),
    [rows]
  )

  const columns: Column<OutboundCallsTableRow>[] = useMemo(
    () => [
      {
        key: 'fio',
        header: t('pages.reports.outboundCalls.columns.operator'),
        // A seat the directory does not know keeps its calls and borrows the
        // extension as its name (utils/format.ts).
        render: (row) => (
          <span className="whitespace-nowrap">{operatorLabel(row.fio, row.sip)}</span>
        ),
      },
      {
        key: 'sip',
        header: t('pages.reports.outboundCalls.columns.sip'),
        render: (row) => <span className="tabular-nums">{row.sip}</span>,
      },
      {
        key: 'full_count',
        header: t('pages.reports.outboundCalls.columns.fullCount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.full_count, language)}</span>
        ),
      },
      {
        key: 'env_count',
        header: t('pages.reports.outboundCalls.columns.envCount'),
        align: 'right',
        // Calls to numbers that are NOT the client's own (a guarantor, a third
        // party, a creditor's contact). A dialled number the client has no
        // contact for counts as neither, so this is a lower bound.
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.env_count, language)}</span>
        ),
      },
      {
        key: 'answer_count',
        header: t('pages.reports.outboundCalls.columns.answerCount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.answer_count, language)}</span>
        ),
      },
      {
        key: 'answer_percent',
        header: t('pages.reports.outboundCalls.columns.answerPercent'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatPercent(row.answer_percent, language)}</span>
        ),
      },
      {
        key: 'quality_count',
        header: t('pages.reports.outboundCalls.columns.qualityCount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.quality_count, language)}</span>
        ),
      },
      {
        key: 'quality_percent',
        header: t('pages.reports.outboundCalls.columns.qualityPercent'),
        align: 'right',
        // Both percents are shares of ALL dialled calls, not of the connected
        // ones — so quality_percent <= answer_percent always.
        render: (row) => (
          <span className="tabular-nums">{formatPercent(row.quality_percent, language)}</span>
        ),
      },
      {
        key: 'answer_duration_seconds',
        header: t('pages.reports.outboundCalls.columns.answerDuration'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatDurationHms(row.answer_duration_seconds)}</span>
        ),
      },
      {
        key: 'quality_duration_seconds',
        header: t('pages.reports.outboundCalls.columns.qualityDuration'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatDurationHms(row.quality_duration_seconds)}</span>
        ),
      },
      {
        key: 'avg_duration_per_call_seconds',
        header: t('pages.reports.outboundCalls.columns.avgPerCall'),
        align: 'right',
        // Talk time ÷ ALL dialled calls — the card's own average, "what a dial
        // costs".
        render: (row) => (
          <span className="tabular-nums">
            {formatDurationHms(row.avg_duration_per_call_seconds)}
          </span>
        ),
      },
      {
        key: 'avg_duration_per_answered_seconds',
        header: t('pages.reports.outboundCalls.columns.avgPerAnswered'),
        align: 'right',
        // Talk time ÷ CONNECTED calls — "how long a conversation is". Null
        // (rendered "—") for a seat that connected nothing: it has no average
        // conversation, which is not an average of zero.
        render: (row) => (
          <span className="tabular-nums">
            {formatDurationHms(row.avg_duration_per_answered_seconds)}
          </span>
        ),
      },
      {
        key: 'department',
        header: t('pages.reports.outboundCalls.columns.department'),
        // Null for an operator whose role carries no department (~2 % of rows)
        // and for a seat the directory does not know at all. Blank counts as
        // missing for the same reason the operator column trims (see
        // `orgLabel` in utils/format.ts).
        render: (row) => orgLabel(row.department),
      },
      {
        key: 'group',
        // Wire name is `group`, not the `group_name` the sibling reports use.
        header: t('pages.reports.outboundCalls.columns.group'),
        render: (row) => orgLabel(row.group),
      },
    ],
    [t, language]
  )

  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} className="w-full" />
}
