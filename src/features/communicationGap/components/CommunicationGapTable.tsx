/**
 * CommunicationGapTable Component
 *
 * «Великий розрив» work list (10 columns) built on the shared DataTable. One
 * row = one CLIENT with a live debt whom nobody has contacted in a while and
 * who has not paid recently; `communication_gap` — the days of silence — is the
 * headline number.
 *
 * The component only formats and links. Rows arrive pre-sorted by the
 * responsible employee's name, then `communication_gap` DESCENDING (worst gaps
 * first, Card 125 parity), then `client_id` (load-bearing for stable
 * pagination: 99.4 % of production rows collide on employee+gap) — the order is
 * fixed SERVER-side and there is deliberately no client-side sorting UI:
 * sorting one page of a server-paginated feed would reorder 50 rows out of tens
 * of thousands and read as a lie.
 *
 * Every date column is a backend DATE (a calendar day, not an instant) with a
 * deliberately asymmetric server-side cut — `sell_date` has no timezone at all,
 * `assignment_date` / `last_promise_date` are cut in the requested timezone,
 * `last_interaction_date` in UTC by card parity — so all four go through the
 * shared `formatCalendarDay` and none is ever shifted here.
 *
 * `last_promise_date` is null on 89–94 % of production rows BY DESIGN: a client
 * is in this feed precisely because nobody extracted a promise to pay. The
 * column shows the same "—" as every other nullable one, which is what makes it
 * read as an absent promise rather than a broken column.
 *
 * The client link is built here from `client_id`: the Metabase card SELECTed a
 * ready-made `https://crm-prionex.online/dashboard/clients/<id>` URL, and the
 * API deliberately dropped it because a hardcoded host breaks on every
 * environment but production (docs/communication-gap-feed.md).
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatCalendarDay } from '@/lib/calendarDay'
import { formatNumber } from '@/lib/localeFormat'
import type { CommunicationGapFeedRow } from '../types'

export interface CommunicationGapTableProps {
  rows: CommunicationGapFeedRow[]
  /** Shown in the table body when the feed legitimately holds no rows. */
  emptyMessage: string
}

/** DataTable requires an `id`; one row is one client, so `client_id` is unique. */
type CommunicationGapTableRow = CommunicationGapFeedRow & { id: number }

/** Placeholder for nullable columns (shared table convention). */
const EMPTY = '—'

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (CommunicationGapFeedTab), so nobody counts the list by hand a second
 * time. It cannot be derived from `columns` at module scope: that array is
 * built inside the component because every header goes through `t`. The pair is
 * kept honest by a test asserting the rendered header count equals this
 * constant (__tests__/CommunicationGapTable.test.tsx).
 */
export const COMMUNICATION_GAP_COLUMN_COUNT = 10

/** Debt principal is an exact Decimal — always two decimals, never truncated. */
const AMOUNT_NUMBER_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

export function CommunicationGapTable({ rows, emptyMessage }: CommunicationGapTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: CommunicationGapTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.client_id })),
    [rows]
  )

  const columns: Column<CommunicationGapTableRow>[] = useMemo(
    () => [
      {
        key: 'inn',
        header: t('pages.reports.communicationGap.columns.inn'),
        render: (row) => (
          <Link
            to={clientDetailsPath(row.client_id)}
            className="text-information-700 hover:underline"
            // A row without a tax id would otherwise be a link named "—".
            // With one, the accessible name stays the tax id itself.
            aria-label={
              row.inn
                ? undefined
                : t('pages.reports.communicationGap.openClient', { id: row.client_id })
            }
          >
            {row.inn ?? EMPTY}
          </Link>
        ),
      },
      {
        key: 'sell_date',
        header: t('pages.reports.communicationGap.columns.sellDate'),
        // Null when the client's latest debt row carries no purchase date (the
        // card's NULLS FIRST pick) — such a client also falls out of any sell
        // window, so a "—" here explains an otherwise puzzling absence.
        render: (row) => formatCalendarDay(row.sell_date, language),
      },
      {
        key: 'assignment_date',
        header: t('pages.reports.communicationGap.columns.assignmentDate'),
        // Cut server-side in the requested timezone (the card hardcoded a
        // "+3 hours") — never shifted here.
        render: (row) => formatCalendarDay(row.assignment_date, language),
      },
      {
        key: 'employee_name',
        header: t('pages.reports.communicationGap.columns.employee'),
        obscured: true,
        // Null only when the directory ships a non-string label: that one cell
        // degrades rather than taking the whole work list down.
        render: (row) => row.employee_name ?? EMPTY,
      },
      {
        key: 'department',
        header: t('pages.reports.communicationGap.columns.department'),
        // Null for an employee with no department membership in the project.
        // Card 125's population filter is `department in (…) OR IS NULL`
        // (unique to this card), so these clients legitimately belong here —
        // the sibling low-verification feed drops them.
        render: (row) => row.department ?? EMPTY,
      },
      {
        key: 'group_name',
        header: t('pages.reports.communicationGap.columns.group'),
        render: (row) => row.group_name ?? EMPTY,
      },
      {
        key: 'last_interaction_date',
        header: t('pages.reports.communicationGap.columns.lastInteraction'),
        // Cut in UTC whatever timezone was requested — frozen card parity (its
        // "+3 hours" there lands after truncation and is a no-op).
        render: (row) => formatCalendarDay(row.last_interaction_date, language),
      },
      {
        key: 'last_promise_date',
        header: t('pages.reports.communicationGap.columns.lastPromise'),
        // Null on 89–94 % of rows by design (see the module comment): nobody
        // extracted a promise to pay, which is why the client is in the feed.
        render: (row) => formatCalendarDay(row.last_promise_date, language),
      },
      {
        key: 'communication_gap',
        header: t('pages.reports.communicationGap.columns.gap'),
        align: 'center',
        // The headline number, rendered plainly: no emphasis threshold, because
        // "how many days is too many" is a product decision nobody has made —
        // the feed's own sort already puts the worst gaps first per employee.
        // formatNumber shows "—" for a null (both inputs missing) or non-finite
        // value instead of "NaN".
        render: (row) => (
          <span className="tabular-nums">{formatNumber(row.communication_gap, language)}</span>
        ),
      },
      {
        key: 'body_amount',
        header: t('pages.reports.communicationGap.columns.bodyAmount'),
        align: 'right',
        // Decimal-as-JSON-string ("15000.00"); formatNumber coerces and shows
        // "—" for anything non-finite instead of "NaN".
        render: (row) => (
          <span className="tabular-nums">
            {formatNumber(row.body_amount, language, AMOUNT_NUMBER_OPTIONS)}
          </span>
        ),
      },
    ],
    [t, language]
  )

  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} className="w-full" />
}
