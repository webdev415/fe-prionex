/**
 * PromisesFeedTable Component
 *
 * «Обіцянки» promises feed (12 columns — Card 119's output shape) built on
 * the shared DataTable. One row = one PROMISE whose promised date falls
 * inside the window; the same client can legitimately appear several times
 * (several promises, several interactions), so there is no unique business
 * id — `client_id` plus the row index within the page is the honest
 * DataTable key.
 *
 * The component only formats and links. Rows arrive pre-sorted SERVER-side
 * (Card 119 parity: department, group, responsible employee) and there is
 * deliberately no client-side sorting UI: sorting one page of a
 * server-paginated feed would reorder 50 rows out of the whole feed and read
 * as a lie.
 *
 * `interaction_date` / `promise_date` are absolute UTC instants (the API
 * deliberately dropped the card's baked-in `+3h` display shift) and are
 * formatted here in the user's PROFILE timezone via the shared
 * `formatDateTime` — date AND time, never date only: promises carry real
 * times of day (09:00/12:30/21:00), and two promises on the same day are
 * worked in time order.
 *
 * A NULL or blank `department` is a real series (12 % of production rows —
 * roles without org context carry real promises) and renders under the
 * localized «Без відділу» label instead of a dash — same trim rule as the
 * promises-daily matrix: the auth-service directory yields whitespace rather
 * than null for an unfilled entry.
 *
 * The client link is built HERE from `client_id` as the internal
 * `/dashboard/clients/:id` route and rendered as a router Link — an in-app
 * navigation like the sibling feeds (searcherFollowup, inboundFollowup), not
 * a full page load. The payload's `link` field (backend absolute URL) is
 * deliberately NOT rendered: its host comes from backend config and defaults
 * to production's, which would be wrong on every other environment.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDateTime } from '@/lib/formatters'
import { formatMoneyAmount } from '@/lib/localeFormat'
import type { PromisesFeedRow } from '../types'

export interface PromisesFeedTableProps {
  rows: PromisesFeedRow[]
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
 * DataTable requires an `id`; a promise row has no unique business key (the
 * card can ship several rows per client and even per chain instance —
 * duplicates included), so the identity is `client_id` plus the index within
 * the page: unique even across duplicate rows, and self-documenting about
 * which client the key belongs to.
 */
type PromisesFeedTableRow = PromisesFeedRow & { id: string }

/** Placeholder for nullable columns (shared table convention). */
const EMPTY = '—'

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (PromisesFeedTab), so nobody counts the list by hand a second time. It
 * cannot be derived from `columns` at module scope: that array is built
 * inside the component because every header goes through `t`. The pair is
 * kept honest by a test asserting the rendered header count equals this
 * constant (__tests__/PromisesFeedTable.test.tsx).
 */
export const PROMISES_FEED_COLUMN_COUNT = 12

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

/** Blank counts as missing, not as content (see the docblock's trim rule). */
function hasText(value: string | null): value is string {
  return !!value && value.trim() !== ''
}

export function PromisesFeedTable({ rows, timezone, emptyMessage }: PromisesFeedTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: PromisesFeedTableRow[] = useMemo(
    () => rows.map((row, index) => ({ ...row, id: `${row.client_id}-${index}` })),
    [rows]
  )

  const columns: Column<PromisesFeedTableRow>[] = useMemo(
    () => [
      {
        key: 'inn',
        header: t('pages.reports.promisesFeed.columns.inn'),
        render: (row) => (hasText(row.inn) ? row.inn : EMPTY),
      },
      {
        key: 'interaction_date',
        header: t('pages.reports.promisesFeed.columns.interactionDate'),
        // Full DATE+TIME in the profile timezone — the card's value carries a
        // real moment, not a calendar day.
        render: (row) => (
          <span className="tabular-nums">{formatDateTime(row.interaction_date, timezone)}</span>
        ),
      },
      {
        key: 'interaction_type',
        header: t('pages.reports.promisesFeed.columns.interactionType'),
        render: (row) => (hasText(row.interaction_type) ? row.interaction_type : EMPTY),
      },
      {
        key: 'promise_date',
        header: t('pages.reports.promisesFeed.columns.promiseDate'),
        // DATE+TIME too: the promised time of day (09:00/12:30/21:00) is what
        // tells a morning promise from an end-of-day one.
        render: (row) => (
          <span className="tabular-nums">{formatDateTime(row.promise_date, timezone)}</span>
        ),
      },
      {
        key: 'promise_amount',
        header: t('pages.reports.promisesFeed.columns.promiseAmount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMoneyAmount(row.promise_amount, language)}</span>
        ),
      },
      {
        key: 'employee_interacted',
        header: t('pages.reports.promisesFeed.columns.employeeInteracted'),
        render: (row) => (hasText(row.employee_interacted) ? row.employee_interacted : EMPTY),
      },
      {
        key: 'employee_responsible',
        header: t('pages.reports.promisesFeed.columns.employeeResponsible'),
        // Null for unassigned clients — kept on purpose: their promises still
        // need collecting.
        render: (row) => (hasText(row.employee_responsible) ? row.employee_responsible : EMPTY),
      },
      {
        key: 'link',
        header: t('pages.reports.promisesFeed.columns.link'),
        // The internal client-card route built from `client_id`, rendered as
        // a router Link like the sibling feeds — NOT the payload's absolute
        // `link` URL, whose backend-configured host defaults to production's.
        // The client id in the label keeps every row's link name unique.
        render: (row) => (
          <Link
            to={clientDetailsPath(row.client_id)}
            className="text-information-700 hover:underline"
          >
            {t('pages.reports.promisesFeed.openClient', { id: row.client_id })}
          </Link>
        ),
      },
      {
        key: 'payment_amount',
        header: t('pages.reports.promisesFeed.columns.paymentAmount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMoneyAmount(row.payment_amount, language)}</span>
        ),
      },
      {
        key: 'last_result',
        header: t('pages.reports.promisesFeed.columns.lastResult'),
        // Empty means "not worked today" — a state, shown as the shared
        // placeholder rather than as invisible empty text.
        render: (row) => (hasText(row.last_result) ? row.last_result : EMPTY),
      },
      {
        key: 'department',
        header: t('pages.reports.promisesFeed.columns.department'),
        // The promises-daily trim rule: null AND whitespace both render the
        // localized «Без відділу» — that money must not look ownerless-blank.
        render: (row) =>
          hasText(row.department)
            ? row.department
            : t('pages.reports.promisesFeed.columns.noDepartment'),
      },
      {
        key: 'group_name',
        header: t('pages.reports.promisesFeed.columns.group'),
        render: (row) => (hasText(row.group_name) ? row.group_name : EMPTY),
      },
    ],
    [t, timezone, language]
  )

  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} className="w-full" />
}
