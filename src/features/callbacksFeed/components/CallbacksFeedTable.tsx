/**
 * CallbacksFeedTable Component
 *
 * «Перезвони» call plan (11 columns — Card 121's output shape) built on the
 * shared DataTable. One row = one INTERACTION that ended in a callback
 * promise whose scheduled time falls inside the window; the same client can
 * legitimately appear several times (up to four rows on a production probe),
 * so there is no unique business id — `client_id` plus the row index within
 * the page is the honest DataTable key.
 *
 * The ONLY feed of the 119/120/121 family without money columns: the call
 * plan answers «whom do I ring, and when», so there is nothing here to
 * format as an amount.
 *
 * The component only formats and links. Rows arrive pre-sorted SERVER-side
 * (Card 121 parity: department, group, responsible employee) and there is
 * deliberately no client-side sorting UI: sorting one page of a
 * server-paginated feed would reorder 50 rows out of the whole feed and read
 * as a lie.
 *
 * `interaction_date` / `promise_date` are absolute UTC instants (the API
 * deliberately dropped the card's baked-in `+3h` display shift) and are
 * formatted here in the user's PROFILE timezone via the shared
 * `formatDateTime` — date AND time, never date only: for this feed the TIME
 * of `promise_date` is the whole content of the row (it is the moment the
 * operator promised to ring back), and two callbacks on the same day are
 * worked in time order.
 *
 * `last_interaction_date` is a bare CALENDAR DAY and goes through
 * `formatIsoDate`, which slices the date part off the string instead of
 * instantiating a Date: the value must render as the same day in every
 * viewer's timezone. (`formatDate` would take the Date path for a value that
 * ever arrives with a `T00:00:00Z` tail and show the previous day west of
 * UTC.) ⚠️ Despite the card's column name `last_call_date` this is NOT a
 * telephony call — it is the client's last interaction of any kind, and the
 * header says so («Дата останнього ЦД», the wording Techno-Finance already
 * moved to).
 *
 * A NULL or blank `department` is a real series (1–2 % of production rows —
 * roles without org context carry real callbacks) and renders under the
 * localized «Без відділу» label instead of a dash — same trim rule as the
 * promises feed: the auth-service directory yields whitespace rather than
 * null for an unfilled entry.
 *
 * The client link is built HERE from `client_id` as the internal
 * `/dashboard/clients/:id` route and rendered as a router Link — an in-app
 * navigation like the sibling feeds (promisesFeed, searcherFollowup), not a
 * full page load. The payload's `link` field (backend absolute URL) is
 * deliberately NOT rendered: its host comes from backend config and defaults
 * to production's, which would be wrong on every other environment.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDateTime, formatIsoDate } from '@/lib/formatters'
import type { CallbacksFeedRow } from '../types'

export interface CallbacksFeedTableProps {
  rows: CallbacksFeedRow[]
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
 * DataTable requires an `id`; a callback row has no unique business key (the
 * card ships one row per interaction, several per client included), so the
 * identity is `client_id` plus the index within the page: unique even across
 * duplicate rows, and self-documenting about which client the key belongs to.
 */
type CallbacksFeedTableRow = CallbacksFeedRow & { id: string }

/** Placeholder for nullable columns (shared table convention). */
const EMPTY = '—'

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (CallbacksFeedTab), so nobody counts the list by hand a second time. It
 * cannot be derived from `columns` at module scope: that array is built
 * inside the component because every header goes through `t`. The pair is
 * kept honest by a test asserting the rendered header count equals this
 * constant (__tests__/CallbacksFeedTable.test.tsx).
 */
export const CALLBACKS_FEED_COLUMN_COUNT = 11

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

/** Blank counts as missing, not as content (see the docblock's trim rule). */
function hasText(value: string | null): value is string {
  return !!value && value.trim() !== ''
}

export function CallbacksFeedTable({ rows, timezone, emptyMessage }: CallbacksFeedTableProps) {
  const { t } = useTranslation('common')

  const data: CallbacksFeedTableRow[] = useMemo(
    () => rows.map((row, index) => ({ ...row, id: `${row.client_id}-${index}` })),
    [rows]
  )

  const columns: Column<CallbacksFeedTableRow>[] = useMemo(
    () => [
      {
        key: 'inn',
        header: t('pages.reports.callbacksFeed.columns.inn'),
        render: (row) => (hasText(row.inn) ? row.inn : EMPTY),
      },
      {
        key: 'interaction_date',
        header: t('pages.reports.callbacksFeed.columns.interactionDate'),
        // Full DATE+TIME in the profile timezone — the card's value carries a
        // real moment, not a calendar day. It is routinely WEEKS older than
        // the window: the window cuts by the scheduled callback, not by this.
        render: (row) => (
          <span className="tabular-nums">{formatDateTime(row.interaction_date, timezone)}</span>
        ),
      },
      {
        key: 'interaction_type',
        header: t('pages.reports.callbacksFeed.columns.interactionType'),
        render: (row) => (hasText(row.interaction_type) ? row.interaction_type : EMPTY),
      },
      {
        key: 'promise_date',
        header: t('pages.reports.callbacksFeed.columns.promiseDate'),
        // DATE+TIME, and here the TIME is the payload: this column is the
        // scheduled moment of the callback — a date-only rendering would
        // collapse a whole day's call plan into one indistinguishable heap.
        render: (row) => (
          <span className="tabular-nums">{formatDateTime(row.promise_date, timezone)}</span>
        ),
      },
      {
        key: 'employee_interacted',
        header: t('pages.reports.callbacksFeed.columns.employeeInteracted'),
        render: (row) => (hasText(row.employee_interacted) ? row.employee_interacted : EMPTY),
      },
      {
        key: 'employee_responsible',
        header: t('pages.reports.callbacksFeed.columns.employeeResponsible'),
        render: (row) => (hasText(row.employee_responsible) ? row.employee_responsible : EMPTY),
      },
      {
        key: 'link',
        header: t('pages.reports.callbacksFeed.columns.link'),
        // The internal client-card route built from `client_id`, rendered as
        // a router Link like the sibling feeds — NOT the payload's absolute
        // `link` URL, whose backend-configured host defaults to production's.
        // The client id in the label keeps every row's link name unique.
        render: (row) => (
          <Link
            to={clientDetailsPath(row.client_id)}
            className="text-information-700 hover:underline"
          >
            {t('pages.reports.callbacksFeed.openClient', { id: row.client_id })}
          </Link>
        ),
      },
      {
        key: 'last_interaction_date',
        header: t('pages.reports.callbacksFeed.columns.lastInteractionDate'),
        // A calendar DAY, formatted by string slicing so every viewer sees the
        // same day (see the docblock). NOT a telephony call, despite the
        // card's `last_call_date` column name.
        render: (row) => (
          <span className="tabular-nums">{formatIsoDate(row.last_interaction_date)}</span>
        ),
      },
      {
        key: 'last_result',
        header: t('pages.reports.callbacksFeed.columns.lastResult'),
        // Empty means "not worked today" — a state, shown as the shared
        // placeholder rather than as invisible empty text. Empty is the
        // MAJORITY in the morning (98 % at 09:20), which is normal, not a bug.
        render: (row) => (hasText(row.last_result) ? row.last_result : EMPTY),
      },
      {
        key: 'department',
        header: t('pages.reports.callbacksFeed.columns.department'),
        // The promises-feed trim rule: null AND whitespace both render the
        // localized «Без відділу» — those callbacks must not look ownerless.
        render: (row) =>
          hasText(row.department)
            ? row.department
            : t('pages.reports.callbacksFeed.columns.noDepartment'),
      },
      {
        key: 'group_name',
        header: t('pages.reports.callbacksFeed.columns.group'),
        render: (row) => (hasText(row.group_name) ? row.group_name : EMPTY),
      },
    ],
    [t, timezone]
  )

  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} className="w-full" />
}
