/**
 * RecordedPaymentsTable Component
 *
 * «Внесені платежі» list (15 columns — Card 76's output shape, in the card's
 * order) built on the shared DataTable. ONE ROW IS ONE PAYMENT: `payment_id`
 * is the primary key and unique within the page; the DataTable id still
 * carries the row index alongside it (the sibling feeds' convention) so the
 * table cannot start collapsing rows if the feed ever emits an id twice.
 *
 * The component only formats and links. Rows arrive pre-sorted SERVER-side
 * (`payment_confirmation_date DESC, id DESC`) and there is deliberately no
 * client-side sorting UI: sorting one page of a server-paginated feed would
 * reorder 50 rows out of the whole feed and read as a lie.
 *
 * TWO CONFIRMATION COLUMNS, on purpose (owner's decision Q4): «Дата
 * підтвердження (банк)» is `payment_confirmation_date`, the bare calendar
 * day the window cuts on, formatted by string slicing (`formatIsoDate`) so
 * every viewer sees the same day; «Підтверджено в CRM» is `verified_at`, the
 * instant the card displays, formatted in the PROFILE timezone with its time.
 * They differ on 2.2 % of rows and the CRM date can lie PAST the window's end
 * — hiding either would hide exactly those rows.
 *
 * «Відповідальний за платіж» is the card's single coalesced column, folded BY
 * ID from the feed's two key-A columns (`../lib/paymentResponsible` — read
 * its docblock before "simplifying" it to a name fold) and rendered as a
 * router Link to the operator-promises tab with the same window and
 * `opu=<user_id>` (acceptance criterion Q7). The other two name columns are
 * plain text; a null name next to a non-null id is a soft-deleted employee
 * and renders the ID, never «—» — «—» would say "nobody", which is false.
 *
 * The client link is built HERE from `client_id` as the internal
 * `/dashboard/clients/:id` route (the card hardcodes production's host into
 * its SELECT; the feed sends no link at all). A soft-deleted client's payment
 * STAYS in the list and its cell carries a text badge — soft delete has no
 * cascade (KAN-902), and the money is real.
 *
 * STATUS IS COLOURED THE WAY THE SOURCE SYSTEM COLOURS IT — `cancelled` and
 * `pending` marked, `verified` calm — through the project's semantic
 * `success`/`error`/`warning` scales, which are defined for BOTH themes in
 * `src/theme/themes.css` (a `dark:` class or a `text-dark-*` token would not
 * be, see docs_local/12-lessons-learned.md). The text badge, not the colour,
 * is what conveys the status: colour alone is invisible to a screen reader.
 *
 * Money goes through `formatMoneyAmount`, right aligned; a zero amount renders
 * "0.00", never a dash.
 *
 * ── OPENREPLAY: WHAT IS MASKED, AND HOW (KAN-KB-54) ────────────────────────
 * The three name columns (recorded by, client's responsible, payment's
 * responsible) are `obscured`: DataTable puts `data-openreplay-obscured` on
 * each of their BODY CELLS, and the tracker wipes every TEXT NODE under a
 * marked element — the visible name, the id shown for a soft-deleted
 * employee, and the `sr-only` sentence of the operator link alike. The
 * tracker masks NOTHING ELSE: `title`, `aria-label`, `alt` and `placeholder`
 * are sent verbatim, from a marked cell as from any other. So no name goes
 * into an attribute here: the operator link's hint («Обіцянки оператора …»)
 * is visually-hidden text INSIDE the marked cell, not a `title`. The same
 * rule holds for the breakdown block (OperatorBreakdown) and for the operator
 * multi-select (`obscured` on CheckboxMultiSelect, which marks the trigger
 * text and the portalled option list); the whole rendered tab is scanned by
 * `__tests__/RecordedPaymentsTab.piiMasking.test.tsx`.
 *
 * The siblings are NOT uniform about this: the four KAN-KB-54 tables
 * (communicationGap, contactTag, searcherFollowup, inboundFollowup) mask
 * their `employee_name`; drains, callbacks, the promises feed and the rest
 * mask no name at all. This table masks because it is the first report that
 * puts employees' names next to clients' money and TINs — the one place a
 * session replay would show who collected how much from whom. Whether the
 * unmasked siblings should follow is a page-wide question for the owner, as
 * is `inn`, which no table on the page masks and this one does not either.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDateTime, formatIsoDate } from '@/lib/formatters'
import { formatMoneyAmount } from '@/lib/localeFormat'
import { foldPaymentResponsible } from '../lib/paymentResponsible'
import { operatorPromisesLink } from '../lib/operatorPromisesLink'
import type { RecordedPaymentRow } from '../types'

export interface RecordedPaymentsTableProps {
  rows: RecordedPaymentRow[]
  /**
   * The window as APPLIED (the response echo) — what the operator link
   * carries over to the operator-promises tab, so both tabs show the same
   * period.
   */
  dateFrom: string
  dateTo: string
  /**
   * IANA timezone of the user's profile — the zone `verified_at` is rendered
   * in (falls back to browser-local when the profile has none, matching the
   * rest of the app's `formatDateTime` consumers).
   */
  timezone?: string | null
  /** Shown in the table body when the feed legitimately holds no rows. */
  emptyMessage: string
}

/** DataTable requires an `id`; `payment_id` is unique, the index is belt and braces. */
type RecordedPaymentsTableRow = RecordedPaymentRow & { id: string }

/** Placeholder for nullable columns (shared table convention). */
const EMPTY = '—'

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (RecordedPaymentsTab), so nobody counts the list by hand a second time.
 * It cannot be derived from `columns` at module scope: that array is built
 * inside the component because every header goes through `t`. The pair is
 * kept honest by a test asserting the rendered header count equals this
 * constant (__tests__/RecordedPaymentsTable.test.tsx).
 */
export const RECORDED_PAYMENTS_COLUMN_COUNT = 15

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

/** Blank counts as missing, not as content (the sibling tables' trim rule). */
function hasText(value: string | null): value is string {
  return !!value && value.trim() !== ''
}

/**
 * A name column's cell: the name, or the ID when the directory has none for
 * a non-null id (a soft-deleted employee), or the placeholder when the row
 * carries no id at all (the client lookup did not resolve the client).
 */
function nameOrId(name: string | null, userId: number | null): string {
  if (hasText(name)) return name
  return userId == null ? EMPTY : String(userId)
}

/** The status pill's classes — both scales exist in every theme. */
function statusClasses(status: string): string {
  switch (status) {
    case 'verified':
      return 'bg-success-100 text-success-700'
    case 'cancelled':
      return 'bg-error-100 text-error-700'
    case 'pending':
      return 'bg-warning-100 text-warning-700'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

/** A small text badge beside a value (service account, deleted client). */
function TextBadge({ children }: { children: string }) {
  return (
    <span className="border-border text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
      {children}
    </span>
  )
}

export function RecordedPaymentsTable({
  rows,
  dateFrom,
  dateTo,
  timezone,
  emptyMessage,
}: RecordedPaymentsTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  // The operator link carries the whole current query string over (see
  // `operatorPromisesLink`), so it needs the live params, not a snapshot.
  const [searchParams] = useSearchParams()

  const data: RecordedPaymentsTableRow[] = useMemo(
    () => rows.map((row, index) => ({ ...row, id: `${row.payment_id}-${index}` })),
    [rows]
  )

  const columns: Column<RecordedPaymentsTableRow>[] = useMemo(
    () => [
      {
        key: 'contract_number',
        header: t('pages.reports.recordedPayments.columns.contractNumber'),
        render: (row) => (hasText(row.contract_number) ? row.contract_number : EMPTY),
      },
      {
        key: 'inn',
        header: t('pages.reports.recordedPayments.columns.inn'),
        // Null for a client identified by e-mail, and for a client the
        // tenant-scoped lookup did not return — the row is still a payment
        // of this project and stays.
        render: (row) => (hasText(row.inn) ? row.inn : EMPTY),
      },
      {
        key: 'amount',
        header: t('pages.reports.recordedPayments.columns.amount'),
        align: 'right',
        render: (row) => (
          <span className="tabular-nums">{formatMoneyAmount(row.amount, language)}</span>
        ),
      },
      {
        key: 'payment_date',
        header: t('pages.reports.recordedPayments.columns.paymentDate'),
        // A bare calendar day — string slicing, never a Date (a viewer west
        // of UTC would otherwise see the previous day).
        render: (row) => <span className="tabular-nums">{formatIsoDate(row.payment_date)}</span>,
      },
      {
        key: 'payment_confirmation_date',
        header: t('pages.reports.recordedPayments.columns.confirmationDate'),
        // The window's anchor: the bank date the rows were selected by.
        render: (row) => (
          <span className="tabular-nums">{formatIsoDate(row.payment_confirmation_date)}</span>
        ),
      },
      {
        key: 'verified_at',
        header: t('pages.reports.recordedPayments.columns.verifiedAt'),
        // The instant the card displays — in the profile zone, WITH its time,
        // and legitimately later than the window's end on some rows.
        render: (row) => (
          <span className="tabular-nums">
            {row.verified_at ? formatDateTime(row.verified_at, timezone) : EMPTY}
          </span>
        ),
      },
      {
        key: 'status',
        header: t('pages.reports.recordedPayments.columns.status'),
        render: (row) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses(row.status)}`}
            data-status={row.status}
          >
            {t(`pages.reports.recordedPayments.status.${row.status}`, {
              defaultValue: row.status,
            })}
          </span>
        ),
      },
      {
        key: 'client',
        header: t('pages.reports.recordedPayments.columns.client'),
        // The internal client-card route built from `client_id`, as every
        // sibling feed does. The client id in the label keeps every row's
        // link name unique; the deleted badge is text, not colour.
        render: (row) => (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <Link
              to={clientDetailsPath(row.client_id)}
              className="text-information-700 hover:underline"
            >
              {t('pages.reports.recordedPayments.openClient', { id: row.client_id })}
            </Link>
            {row.client_is_deleted && (
              <TextBadge>{t('pages.reports.recordedPayments.deletedClientBadge')}</TextBadge>
            )}
          </span>
        ),
      },
      {
        key: 'recorded_by',
        header: t('pages.reports.recordedPayments.columns.recordedBy'),
        obscured: true,
        // Key A, «хто вніс». A soft-deleted recorder renders as their id.
        render: (row) => nameOrId(row.recorded_by_full_name, row.recorded_by_user_id),
      },
      {
        key: 'client_responsible',
        header: t('pages.reports.recordedPayments.columns.clientResponsible'),
        obscured: true,
        // Key B — THE axis of the operator filter and of the breakdown. The
        // service account («Договор закрыт ») is an ordinary responsible with
        // a text badge, never hidden (decision Q8).
        render: (row) => (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {nameOrId(row.client_responsible_full_name, row.client_responsible_user_id)}
            {row.client_responsible_is_service && (
              <TextBadge>{t('pages.reports.recordedPayments.serviceBadge')}</TextBadge>
            )}
          </span>
        ),
      },
      {
        key: 'payment_responsible',
        header: t('pages.reports.recordedPayments.columns.paymentResponsible'),
        obscured: true,
        // The card's coalesced column, folded BY ID (see the docblock), and
        // the operator link of criterion Q7: same window, `opu=<user_id>`.
        render: (row) => {
          const responsible = foldPaymentResponsible(row)
          if (!responsible) return EMPTY
          return (
            <Link
              to={operatorPromisesLink({
                userId: responsible.userId,
                dateFrom,
                dateTo,
                currentSearch: searchParams,
              })}
              className="text-information-700 hover:underline"
              data-user-id={responsible.userId}
            >
              {/* The destination hint is visually-hidden TEXT inside the
                  obscured cell, never a `title`: the tracker masks text nodes
                  and sends attributes verbatim (see the docblock). */}
              <span aria-hidden="true">{responsible.label}</span>
              <span className="sr-only">
                {t('pages.reports.recordedPayments.operatorPromisesLink', {
                  name: responsible.label,
                })}
              </span>
            </Link>
          )
        },
      },
      {
        key: 'purchase_date',
        header: t('pages.reports.recordedPayments.columns.purchaseDate'),
        render: (row) => <span className="tabular-nums">{formatIsoDate(row.purchase_date)}</span>,
      },
      {
        key: 'seller_name',
        header: t('pages.reports.recordedPayments.columns.seller'),
        render: (row) => (hasText(row.seller_name) ? row.seller_name : EMPTY),
      },
      {
        key: 'payment_method',
        header: t('pages.reports.recordedPayments.columns.paymentMethod'),
        render: (row) => (hasText(row.payment_method) ? row.payment_method : EMPTY),
      },
      {
        key: 'payment_type',
        header: t('pages.reports.recordedPayments.columns.paymentType'),
        // `coalesce(company_code, payment_comment)` — NULL on 4.7 % of rows,
        // which is data, not a fault: the shared placeholder.
        render: (row) => (hasText(row.payment_type) ? row.payment_type : EMPTY),
      },
    ],
    [t, timezone, language, dateFrom, dateTo, searchParams]
  )

  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} className="w-full" />
}
