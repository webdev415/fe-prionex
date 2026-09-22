/**
 * DrainsFeedTable Component
 *
 * «Зливи» broken-promise list (13 columns — Card 120's output shape, in the
 * source system's order) built on the shared DataTable. ONE ROW IS ONE CLIENT:
 * the backend resolves each client's last promise and emits them at most once,
 * so — unlike the promises and callbacks feeds, where a client legitimately
 * repeats — `client_id` is already unique within the page. The DataTable id
 * still carries the row index alongside it, because a key that is unique only
 * while a server invariant holds is a key that breaks silently the day the
 * invariant is relaxed, and the index costs nothing.
 *
 * The component only formats and links. Rows arrive pre-sorted SERVER-side
 * (department, group, the responsible employee's last name, `client_id`) and
 * there is deliberately no client-side sorting UI: sorting one page of a
 * server-paginated feed would reorder 50 rows out of the whole feed and read
 * as a lie.
 *
 * `interaction_date` / `promise_date` are absolute UTC instants (the API
 * deliberately dropped the card's baked-in `+3h` display shift) and are
 * formatted here in the user's PROFILE timezone via the shared
 * `formatDateTime` — date AND time, like both money siblings. The time is not
 * decoration on this card: 11.98 % of its promises change their calendar DAY
 * under the shift the card baked in, so a cell that showed only a day would
 * hide exactly the rows where the zone matters.
 *
 * `last_interaction_date` is a bare CALENDAR DAY and goes through
 * `formatIsoDate`, which slices the date part off the string instead of
 * instantiating a Date: the value must render as the same day in every
 * viewer's timezone. (`formatDate` would take the Date path for a value that
 * ever arrives with a `T00:00:00Z` tail and show the previous day west of
 * UTC.) It is also the column `hide_worked` compares against — what the row
 * shows and what the filter used must not disagree.
 *
 * `promise_amount` / `payment_amount` are exact decimals shipped as strings
 * and go through `formatMoneyAmount` (the promises feed's precedent), right
 * aligned. `payment_amount` can be ZERO — the overwhelming majority — and can
 * even be NEGATIVE where the payment window holds a reversal; both render as
 * the number they are, never as a placeholder, because "0.00 paid" is the
 * whole point of the report.
 *
 * A NULL or blank `department` (9.3 % of production rows) renders under the
 * localized «Без відділу» label rather than a dash — same trim rule and same
 * reasoning as both money siblings: those clients owe real money and must not
 * look ownerless. `group_name` (17.6 % null) keeps the shared dash, as
 * everywhere else on the page.
 *
 * The client link is built HERE from `client_id` as the internal
 * `/dashboard/clients/:id` route and rendered as a router Link — an in-app
 * navigation like the sibling feeds, not a full page load. The payload's
 * `link` field (backend absolute URL) is deliberately NOT rendered: its host
 * comes from backend config and defaults to production's, which would be wrong
 * on every other environment.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDateTime, formatIsoDate } from '@/lib/formatters'
import { formatMoneyAmount } from '@/lib/localeFormat'
import type { DrainsFeedRow } from '../types'

export interface DrainsFeedTableProps {
  rows: DrainsFeedRow[]
  /**
   * IANA timezone of the user's profile — the zone both datetime columns are
   * rendered in (falls back to browser-local when the profile has none,
   * matching the rest of the app's `formatDateTime` consumers).
   */
  timezone?: string | null
  /** Shown in the table body when the feed legitimately holds no rows. */
  emptyMessage: string
}

/**
 * DataTable requires an `id`. A drain row IS one client — `client_id` alone
 * would do today — but the id keeps the page index alongside it so the table
 * cannot start collapsing rows if the feed ever emits a client twice.
 */
type DrainsFeedTableRow = DrainsFeedRow & { id: string }

/** Placeholder for nullable columns (shared table convention). */
const EMPTY = '—'

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (DrainsFeedTab), so nobody counts the list by hand a second time. It
 * cannot be derived from `columns` at module scope: that array is built inside
 * the component because every header goes through `t`. The pair is kept honest
 * by a test asserting the rendered header count equals this constant
 * (__tests__/DrainsFeedTable.test.tsx).
 */
export const DRAINS_FEED_COLUMN_COUNT = 13

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

/** Blank counts as missing, not as content (see the docblock's trim rule). */
function hasText(value: string | null): value is string {
  return !!value && value.trim() !== ''
}

export function DrainsFeedTable({ rows, timezone, emptyMessage }: DrainsFeedTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: DrainsFeedTableRow[] = useMemo(
    () => rows.map((row, index) => ({ ...row, id: `${row.client_id}-${index}` })),
    [rows]
  )

  const columns: Column<DrainsFeedTableRow>[] = useMemo(
    () => [
      {
        key: 'inn',
        header: t('pages.reports.drainsFeed.columns.inn'),
        render: (row) => (hasText(row.inn) ? row.inn : EMPTY),
      },
      {
        key: 'interaction_date',
        header: t('pages.reports.drainsFeed.columns.interactionDate'),
        // When the promise was MADE. Routinely WEEKS older than the window:
        // the window cuts by the promised day, not by this.
        render: (row) => (
          <span className="tabular-nums">{formatDateTime(row.interaction_date, timezone)}</span>
        ),
      },
      {
        key: 'interaction_type',
        header: t('pages.reports.drainsFeed.columns.interactionType'),
        // The SECOND step group's label («Реструктуризація» / «Можлива оплата»
        // / «Повна оплата» / «Часткова оплата»), resolved server-side. Card 121
        // takes this column from the first group instead, which here would
        // print «Домовленість» on every single row.
        render: (row) => (hasText(row.interaction_type) ? row.interaction_type : EMPTY),
      },
      {
        key: 'promise_date',
        header: t('pages.reports.drainsFeed.columns.promiseDate'),
        // The window's axis, and the column whose calendar day the zone can
        // move (11.98 % of promises) — hence date AND time.
        render: (row) => (
          <span className="tabular-nums">{formatDateTime(row.promise_date, timezone)}</span>
        ),
      },
      {
        key: 'promise_amount',
        header: t('pages.reports.drainsFeed.columns.promiseAmount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMoneyAmount(row.promise_amount, language)}</span>
        ),
      },
      {
        key: 'employee_interacted',
        header: t('pages.reports.drainsFeed.columns.employeeInteracted'),
        render: (row) => (hasText(row.employee_interacted) ? row.employee_interacted : EMPTY),
      },
      {
        key: 'employee_responsible',
        header: t('pages.reports.drainsFeed.columns.employeeResponsible'),
        // The client's RESPONSIBLE employee, and the one the org labels below
        // describe — not the recorder of the promise.
        render: (row) => (hasText(row.employee_responsible) ? row.employee_responsible : EMPTY),
      },
      {
        key: 'link',
        header: t('pages.reports.drainsFeed.columns.link'),
        // The internal client-card route built from `client_id`, rendered as a
        // router Link like the sibling feeds — NOT the payload's absolute
        // `link` URL, whose backend-configured host defaults to production's.
        // The client id in the label keeps every row's link name unique.
        render: (row) => (
          <Link
            to={clientDetailsPath(row.client_id)}
            className="text-information-700 hover:underline"
          >
            {t('pages.reports.drainsFeed.openClient', { id: row.client_id })}
          </Link>
        ),
      },
      {
        key: 'payment_amount',
        header: t('pages.reports.drainsFeed.columns.paymentAmount'),
        align: 'right',
        // Zero is the normal value here and renders as "0.00", never as a
        // dash: the whole feed is "promised more than they paid", so an empty
        // cell would read as missing data on the majority of rows.
        render: (row) => (
          <span className="tabular-nums">{formatMoneyAmount(row.payment_amount, language)}</span>
        ),
      },
      {
        key: 'last_interaction_date',
        header: t('pages.reports.drainsFeed.columns.lastInteractionDate'),
        // A calendar DAY, formatted by string slicing so every viewer sees the
        // same day (see the docblock) — and the exact value `hide_worked`
        // compares the promised day against.
        render: (row) => (
          <span className="tabular-nums">{formatIsoDate(row.last_interaction_date)}</span>
        ),
      },
      {
        key: 'last_result',
        header: t('pages.reports.drainsFeed.columns.lastResult'),
        // Empty means "nobody touched this client today" — a state, shown as
        // the shared placeholder rather than as invisible empty text. This is
        // the column `hide_worked_today` reads.
        render: (row) => (hasText(row.last_result) ? row.last_result : EMPTY),
      },
      {
        key: 'department',
        header: t('pages.reports.drainsFeed.columns.department'),
        // The money siblings' trim rule: null AND whitespace both render the
        // localized «Без відділу». 9.3 % of rows land here, and they are a real
        // population (the source system's own filter silently drops them) —
        // that money must not look ownerless-blank.
        render: (row) =>
          hasText(row.department)
            ? row.department
            : t('pages.reports.drainsFeed.columns.noDepartment'),
      },
      {
        key: 'group_name',
        header: t('pages.reports.drainsFeed.columns.group'),
        render: (row) => (hasText(row.group_name) ? row.group_name : EMPTY),
      },
    ],
    [t, timezone, language]
  )

  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} className="w-full" />
}
