/**
 * ContactTagTable Component
 *
 * «Контакт/Неконтакт» work list (10 columns) built on the shared DataTable.
 * One row = one CLIENT with a live debt who carries the «Контакт» or
 * «Неконтакт» tag and whom nobody has touched — neither an interaction nor a
 * re-assignment — for longer than that tag's threshold, and who has no live
 * promise.
 *
 * ## 13 contract fields, 10 rendered columns
 *
 * The wire row carries 13 fields; three are keys rather than facts an operator
 * reads, and each is folded exactly the way the sibling feeds fold it:
 *
 * - `client_id` becomes the tax-id cell's LINK. The Metabase card SELECTs a
 *   ready-made `https://crm-prionex.online/dashboard/clients/<id>` URL and the
 *   API deliberately dropped it, because a hardcoded host breaks on every
 *   environment but production (api docs/contact-tag-feed.md);
 * - `employee_id` is not rendered at all. It exists in the contract because the
 *   card identified the responsible employee by a concatenated string only,
 *   which is what blocked RBAC scoping in the source system — it is a join key,
 *   and the sibling Card 125 feed drops it from its table for the same reason;
 * - `tag_code` drives the sub-tab strip (`utils/tagTabs.ts`) and is not a
 *   column of its own: `tag_name` is its display label, and showing both would
 *   put «nekontakt» next to «Неконтакт» in every row.
 *
 * So the rendered set is the card's own eleven columns minus the link it built
 * by hand — the same 11→10 arithmetic as the sibling Card 125 feed's table.
 *
 * The component only formats and links. Rows arrive pre-sorted by the
 * responsible employee's name, then `last_interaction_date` DESCENDING (the
 * most recently touched first inside each employee's block, Card 124 parity),
 * then `client_id` — the last key load-bearing for stable pagination over a
 * ~880-page feed. The order is fixed SERVER-side and there is deliberately no
 * client-side sorting UI: sorting one page of a server-paginated feed would
 * reorder 50 rows out of 44 000 and read as a lie.
 *
 * Every date column is a backend DATE (a calendar day, not an instant) with a
 * deliberately asymmetric server-side cut — `sell_date` has no timezone at all,
 * `assignment_date` / `last_planed_interaction_date` are cut in the requested
 * timezone, `last_interaction_date` in UTC by card parity — so all four go
 * through the shared `formatCalendarDay` and none is ever shifted here.
 *
 * `last_planed_interaction_date` is null on most rows BY DESIGN: a client is in
 * this feed precisely because nobody extracted a promise. The column shows the
 * same "—" as every other nullable one, which is what makes it read as an
 * absent promise rather than a broken column. When it DOES carry a date, that
 * date is real: unlike the card (whose `ORDER BY promise DESC` is NULLS FIRST,
 * so an undated qualifier wins the lateral and blanks the cell), this feed
 * orders NULLS LAST.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatCalendarDay } from '@/lib/calendarDay'
import { formatMoneyAmount } from '@/lib/localeFormat'
import type { ContactTagFeedRow } from '../types'

export interface ContactTagTableProps {
  rows: ContactTagFeedRow[]
  /** Shown in the table body when the feed legitimately holds no rows. */
  emptyMessage: string
}

/** DataTable requires an `id`; one row is one client, so `client_id` is unique. */
type ContactTagTableRow = ContactTagFeedRow & { id: number }

/** Placeholder for nullable columns (shared table convention). */
const EMPTY = '—'

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (ContactTagFeedTab), so nobody counts the list by hand a second time. It
 * cannot be derived from `columns` at module scope: that array is built inside
 * the component because every header goes through `t`. The pair is kept honest
 * by a test asserting the rendered header count equals this constant
 * (__tests__/ContactTagTable.test.tsx).
 */
export const CONTACT_TAG_COLUMN_COUNT = 10

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

export function ContactTagTable({ rows, emptyMessage }: ContactTagTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: ContactTagTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.client_id })),
    [rows]
  )

  const columns: Column<ContactTagTableRow>[] = useMemo(
    () => [
      {
        key: 'inn',
        header: t('pages.reports.contactTag.columns.inn'),
        render: (row) => (
          <Link
            to={clientDetailsPath(row.client_id)}
            className="text-information-700 hover:underline"
            // A row without a tax id would otherwise be a link named "—".
            // With one, the accessible name stays the tax id itself.
            aria-label={
              row.inn ? undefined : t('pages.reports.contactTag.openClient', { id: row.client_id })
            }
          >
            {row.inn ?? EMPTY}
          </Link>
        ),
      },
      {
        key: 'tag_name',
        header: t('pages.reports.contactTag.columns.tag'),
        // The LIVE label straight from the tag directory, never a translated
        // or stored name: the sub-tabs key on `tag_code` precisely so a renamed
        // tag keeps filtering while its rows show the new name here. Null only
        // when the directory ships a non-string label — that one cell degrades
        // rather than taking the whole work list down.
        render: (row) => row.tag_name ?? EMPTY,
      },
      {
        key: 'sell_date',
        header: t('pages.reports.contactTag.columns.sellDate'),
        // Computed over ALL of the client's debts including closed ones (card
        // parity), so it says when the portfolio was last bought, not when the
        // live debt was. Null when the latest debt row carries no purchase
        // date — such a client also falls out of any sell window, so a "—" here
        // explains an otherwise puzzling absence.
        render: (row) => formatCalendarDay(row.sell_date, language),
      },
      {
        key: 'assignment_date',
        header: t('pages.reports.contactTag.columns.assignmentDate'),
        // Cut server-side in the requested timezone (the card hardcoded a
        // "+3 hours") — never shifted here. It is half the population filter:
        // a client re-assigned recently is somebody's fresh work, whatever
        // their interaction history says.
        render: (row) => formatCalendarDay(row.assignment_date, language),
      },
      {
        key: 'last_planed_interaction_date',
        header: t('pages.reports.contactTag.columns.lastPlanned'),
        // Null on most rows by design (see the module comment). A date here is
        // always in the PAST — a future one would have kept the client out.
        render: (row) => formatCalendarDay(row.last_planed_interaction_date, language),
      },
      {
        key: 'employee_name',
        header: t('pages.reports.contactTag.columns.employee'),
        obscured: true,
        // Null only when the directory ships a non-string label. An employee
        // the directory does not know at all takes their clients out of the
        // feed entirely (card parity), so this is not the "unassigned" case.
        render: (row) => row.employee_name ?? EMPTY,
      },
      {
        key: 'department',
        header: t('pages.reports.contactTag.columns.department'),
        // May carry the card's "shelf" display override (6988 → Дайлер,
        // 7000/6278 → Стягнення): live here, unlike in the sibling Card 125
        // feed where every account it names is blacklisted.
        render: (row) => row.department ?? EMPTY,
      },
      {
        key: 'group_name',
        header: t('pages.reports.contactTag.columns.group'),
        // Same shelf override applies («Полка» for four accounts).
        render: (row) => row.group_name ?? EMPTY,
      },
      {
        key: 'last_interaction_date',
        header: t('pages.reports.contactTag.columns.lastInteraction'),
        // Cut in UTC whatever timezone was requested — frozen card parity. This
        // feed's "last interaction" ignores NO chain (its three siblings
        // exclude chains 4/5/6): here ANY recorded touch counts as a touch.
        render: (row) => formatCalendarDay(row.last_interaction_date, language),
      },
      {
        key: 'body_amount',
        header: t('pages.reports.contactTag.columns.bodyAmount'),
        align: 'right',
        // Decimal-as-JSON-string ("15000.00") — the sum of the principals of
        // the client's ACTIVE debts. formatMoneyAmount coerces and shows "—"
        // for anything non-finite instead of "NaN".
        render: (row) => (
          <span className="tabular-nums">{formatMoneyAmount(row.body_amount, language)}</span>
        ),
      },
    ],
    [t, language]
  )

  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} className="w-full" />
}
