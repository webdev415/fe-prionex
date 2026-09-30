/**
 * OperatorPromisesTable Component
 *
 * «Обіцянки по операторах» report table (12 columns) built on the shared
 * DataTable. One row = one OPERATOR: the chain runs they first touched in the
 * period, the money they took promises for, the money that was DUE in the
 * period, the money that arrived, and the conversion between the last two.
 *
 * The column set follows Techno-Finance's `PromisesTable` (ФИО, кол-во ЦД,
 * взято, поставлено, оплачено, не оплачено, конверсия) with one deliberate
 * difference, driven by the contract:
 *
 * - TF renders SIX payment columns under a two-level header — paid / unpaid /
 *   conversion for "все платежи" and again for "верифицированные". Since the
 *   backend added `verified_unpaid` / `verified_conversion` (2026-08-19,
 *   decision of Алексей: full column parity with TF) this table shows all six
 *   too, as a flat list rather than under a two-level header. Nothing is
 *   derived here: both verified figures arrive computed, so a money metric
 *   keeps exactly ONE definition, on the server.
 * - TF puts the department in a sub-tab and splits each department into
 *   per-group sub-tables. Here department and group are COLUMNS: the «Всі» tab
 *   deliberately mixes departments (that is the whole point of it — the card's
 *   dropped departments carry ≈ 631 000 ₴ a month), and the response is a
 *   single unpaginated list of ~136 rows already sorted `department` →
 *   `group_name` → `fio` → `user_id`, so one table reads the same way the sort
 *   does without fragmenting it into a dozen sections.
 *
 * Rows are rendered in the SERVER's order and there is deliberately no sorting
 * UI: the order is a contract (a NULL department or group sorts last, and
 * `is_active` deliberately does not participate — a dismissed operator stays in
 * their department and group rather than being herded to the bottom).
 *
 * Dismissed operators (`is_active: false`) are dimmed AND carry a text badge
 * next to the name. The badge is what actually conveys it — dimming alone is a
 * colour-only signal, unreadable for a screen reader and unreliable across the
 * project's themes — and the dimming is plain `opacity`, which is
 * theme-independent by construction (a token like `text-dark-500` is nearly
 * white in the dark themes; see docs_local/12-lessons-learned.md).
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type { OperatorPromisesRow } from '../types'
import { EMPTY, formatConversion, formatCount, formatMoney } from '../utils/format'
import { operatorPromisesRowAnchorId } from '../utils/rowAnchor'

export interface OperatorPromisesTableProps {
  rows: OperatorPromisesRow[]
  /** Shown in the table body when the selected department legitimately has no rows. */
  emptyMessage: string
  /**
   * OPT-IN: the operator a sibling tab linked to (`?opu=<user_id>`). Their
   * row is marked — a ring (`OPERATOR_PROMISES_HIGHLIGHT_CLASS`) in the same
   * `information` scale the shared DataTable uses for a selected row, defined
   * in every theme — plus `data-highlighted` and `aria-current` on the name
   * cell, which is what a screen reader and the tab's scroll-into-view read.
   * Never a filter: the roster stays whole. Absent = no row is marked,
   * exactly as before the prop existed.
   */
  highlightedUserId?: number | null
}

/** DataTable requires an `id`; rows are keyed by `user_id` server-side, which is unique. */
type OperatorPromisesTableRow = OperatorPromisesRow & { id: number }

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (OperatorPromisesTab), so nobody counts the list by hand a second time.
 * It cannot be derived from `columns` at module scope: that array is built
 * inside the component because every header goes through `t`. The pair is kept
 * honest by a test asserting the rendered header count equals this constant.
 */
export const OPERATOR_PROMISES_COLUMN_COUNT = 12

/**
 * The linked row's mark: a 1px inset ring, NOT a background.
 *
 * DataTable paints every row's background itself — `bg-muted` on even rows,
 * `bg-card` on odd ones (or `bg-information-50` for its own selected rows,
 * which it REPLACES rather than appends) — and `rowClassName` is appended
 * after it. Appending a second `bg-*` class does not override the first:
 * Tailwind v4 emits utilities in a fixed source order and the browser
 * resolves two same-specificity rules by that order, not by the order of the
 * tokens in `class`. Compiled from `src/index.css`, `.bg-information-50`
 * sits BEFORE `.bg-muted`, so a background highlight vanished on every even
 * row, the first one included. A ring is a `box-shadow`: it competes with
 * nothing the row already sets, so it shows on every row in every theme —
 * the same device ClientDetailPage and ClientReversalsTable use to mark a
 * payment row in this very DataTable. `ring-inset` keeps the 1px inside the
 * row's own box, where a neighbouring row's background cannot paint over it
 * (the table is `border-collapse`). Pinned by a test that compiles the
 * stylesheet and checks the ring sets no `background-color`.
 */
export const OPERATOR_PROMISES_HIGHLIGHT_CLASS = 'ring-1 ring-inset ring-information-500'

export function OperatorPromisesTable({
  rows,
  emptyMessage,
  highlightedUserId = null,
}: OperatorPromisesTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: OperatorPromisesTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.user_id })),
    [rows]
  )

  const columns: Column<OperatorPromisesTableRow>[] = useMemo(
    () => [
      {
        key: 'fio',
        header: t('pages.reports.operatorPromises.columns.operator'),
        // `fio` is assembled server-side from the directory's name parts and is
        // null only when the directory ships nothing usable — that ONE cell
        // degrades instead of dropping the operator's money from the report.
        render: (row) => (
          <span
            className="inline-flex items-center gap-2 whitespace-nowrap"
            // The anchor a linking tab scrolls to, and the mark assistive
            // technology reads; both exist only on the linked row.
            {...(row.user_id === highlightedUserId
              ? {
                  id: operatorPromisesRowAnchorId(row.user_id),
                  'data-highlighted': 'true',
                  'aria-current': 'true' as const,
                }
              : {})}
          >
            {row.fio ?? EMPTY}
            {!row.is_active && (
              // Text, not colour: the dimmed row alone would be invisible to a
              // screen reader and to anyone reading a high-contrast theme.
              <span className="border-border text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
                {t('pages.reports.operatorPromises.inactiveBadge')}
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'department',
        header: t('pages.reports.operatorPromises.columns.department'),
        // Null for an operator with no role/department membership in the
        // project. Such rows exist only on the «Всі» tab (a department tab
        // matches an exact name) and they carry real money — the report has no
        // department filter precisely so they are not lost.
        render: (row) => row.department ?? EMPTY,
      },
      {
        key: 'group_name',
        header: t('pages.reports.operatorPromises.columns.group'),
        render: (row) => row.group_name ?? EMPTY,
      },
      {
        key: 'interactions_count',
        header: t('pages.reports.operatorPromises.columns.interactions'),
        align: 'right',
        // CHAIN RUNS first touched in the window, not interaction rows: one
        // promise is counted once per run (the card double-counts a run touched
        // twice). Hence the column is named after runs, not interactions.
        render: (row) => (
          <span className="tabular-nums">{formatCount(row.interactions_count, language)}</span>
        ),
      },
      {
        key: 'sum_from',
        header: t('pages.reports.operatorPromises.columns.sumFrom'),
        align: 'right',
        // Promised amounts of the runs first touched in the window — cut on the
        // interaction's created_at, so a promise TAKEN in June and DUE in July
        // lands here in June and in `sum_to` in July.
        render: (row) => (
          <span className="tabular-nums">{formatMoney(row.sum_from, language)}</span>
        ),
      },
      {
        key: 'sum_to',
        header: t('pages.reports.operatorPromises.columns.sumTo'),
        align: 'right',
        // Promised amounts DUE in the window, whenever promised — the
        // denominator of `conversion`, and the only column the requested
        // timezone moves.
        render: (row) => <span className="tabular-nums">{formatMoney(row.sum_to, language)}</span>,
      },
      {
        key: 'paid_full',
        header: t('pages.reports.operatorPromises.columns.paidFull'),
        align: 'right',
        // Everything that arrived in the window and is not cancelled — PENDING
        // payments included («с неверифицированными» in the card).
        render: (row) => (
          <span className="tabular-nums">{formatMoney(row.paid_full, language)}</span>
        ),
      },
      // Column order mirrors TF's two payment trios: the full-payment trio
      // (paid / unpaid / conversion) first, then the same trio over the
      // verified subset (decision 2026-08-19, TF renders them as two groups
      // under a two-level header).
      {
        key: 'unpaid',
        header: t('pages.reports.operatorPromises.columns.unpaid'),
        align: 'right',
        // `sum_to − paid_full`: positive = still owed. A NEGATIVE value is not
        // an error — the operator collected more than was due in the window,
        // which is common because payments are never matched to the promises
        // they settle. (The card's diff carries the other sign.)
        render: (row) => <span className="tabular-nums">{formatMoney(row.unpaid, language)}</span>,
      },
      {
        key: 'conversion',
        header: t('pages.reports.operatorPromises.columns.conversion'),
        align: 'right',
        // "Money collected ÷ money due", not "share of promises kept": it
        // legitimately exceeds 100 % (production maximum 815 %) and is null —
        // rendered "—" — whenever nothing was due.
        render: (row) => (
          <span className="tabular-nums">{formatConversion(row.conversion, language)}</span>
        ),
      },
      {
        key: 'paid_verified',
        header: t('pages.reports.operatorPromises.columns.paidVerified'),
        align: 'right',
        // The verified subset of the same rows, hence always <= paid_full.
        render: (row) => (
          <span className="tabular-nums">{formatMoney(row.paid_verified, language)}</span>
        ),
      },
      {
        key: 'verified_unpaid',
        header: t('pages.reports.operatorPromises.columns.unpaidVerified'),
        align: 'right',
        // `sum_to − paid_verified`, the verified twin of `unpaid`. Because
        // `paid_verified <= paid_full` it is always >= `unpaid`, so it goes
        // negative less often — but a verified overpayment is a real row and is
        // shown with its sign rather than clamped.
        render: (row) => (
          <span className="tabular-nums">{formatMoney(row.verified_unpaid, language)}</span>
        ),
      },
      {
        key: 'verified_conversion',
        header: t('pages.reports.operatorPromises.columns.conversionVerified'),
        align: 'right',
        // `paid_verified / sum_to`, null — rendered "—" — under exactly the same
        // zero-denominator rule as `conversion`.
        render: (row) => (
          <span className="tabular-nums">
            {formatConversion(row.verified_conversion, language)}
          </span>
        ),
      },
    ],
    [t, language, highlightedUserId]
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage={emptyMessage}
      className="w-full"
      // Dismissed operators keep their place in the sort and are dimmed rather
      // than removed — the money they collected must not vanish from a
      // historical period (decision of 2026-08-19). `opacity` is deliberate:
      // it is theme-independent, unlike any colour token. The linked
      // operator's row gets a ring, never a background — see the constant for
      // why a `bg-*` class here would lose to DataTable's own zebra
      // background; both marks can apply at once.
      rowClassName={(row) =>
        [
          row.is_active ? '' : 'opacity-60',
          row.user_id === highlightedUserId ? OPERATOR_PROMISES_HIGHLIGHT_CLASS : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
    />
  )
}
