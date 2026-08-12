/**
 * LowVerificationTable Component
 *
 * «Мало верифікацій 3-х осіб» work list (9 columns) built on the shared
 * DataTable. One row = one CLIENT (the two sibling reports are per-employee),
 * and the employee's name/department/group are labels on that client.
 *
 * The component only formats and links. Rows arrive pre-sorted by
 * `verified_count` ascending, then the employee's full name, then `client_id`
 * (Card 148 parity, `client_id` load-bearing for stable pagination over 99.3 %
 * tied rows) — the order is fixed SERVER-side and there is deliberately no
 * client-side sorting UI: sorting one page of a server-paginated feed would
 * reorder 50 rows out of thousands and read as a lie.
 *
 * The client link is built here from `client_id`: the Metabase card SELECTed a
 * ready-made `https://crm-prionex.online/dashboard/clients/<id>` URL, and the
 * API deliberately dropped it because a hardcoded host breaks on every
 * environment but production (docs/low-verification-feed.md).
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatNumber } from '@/lib/localeFormat'
import type { LowVerificationFeedRow } from '../types'
import { formatCalendarDay } from '../utils/calendarDay'

export interface LowVerificationTableProps {
  rows: LowVerificationFeedRow[]
  /** Shown in the table body when the feed legitimately holds no rows. */
  emptyMessage: string
}

/** DataTable requires an `id`; one row is one client, so `client_id` is unique. */
type LowVerificationTableRow = LowVerificationFeedRow & { id: number }

/** Placeholder for nullable columns (`inn`, `group_name`, the two nullable dates). */
const EMPTY = '—'

/** Debt principal is an exact Decimal — always two decimals, never truncated. */
const AMOUNT_NUMBER_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

export function LowVerificationTable({ rows, emptyMessage }: LowVerificationTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: LowVerificationTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.client_id })),
    [rows]
  )

  const columns: Column<LowVerificationTableRow>[] = useMemo(
    () => [
      {
        key: 'inn',
        header: t('pages.reports.lowVerification.columns.inn'),
        render: (row) => (
          <Link
            to={clientDetailsPath(row.client_id)}
            className="text-information-700 hover:underline"
            // A row without a tax id would otherwise be a link named "—".
            // With one, the accessible name stays the tax id itself.
            aria-label={
              row.inn
                ? undefined
                : t('pages.reports.lowVerification.openClient', { id: row.client_id })
            }
          >
            {row.inn ?? EMPTY}
          </Link>
        ),
      },
      {
        key: 'sell_date',
        header: t('pages.reports.lowVerification.columns.sellDate'),
        render: (row) => formatCalendarDay(row.sell_date, language),
      },
      {
        key: 'assignment_date',
        header: t('pages.reports.lowVerification.columns.assignmentDate'),
        // Cut server-side in the requested timezone (Card 148 replaced a
        // hardcoded "+3 hours" with the IANA parameter) — never shifted here.
        render: (row) => formatCalendarDay(row.assignment_date, language),
      },
      {
        key: 'full_name',
        header: t('pages.reports.lowVerification.columns.employee'),
      },
      {
        key: 'department',
        header: t('pages.reports.lowVerification.columns.department'),
      },
      {
        key: 'group_name',
        header: t('pages.reports.lowVerification.columns.group'),
        render: (row) => row.group_name ?? EMPTY,
      },
      {
        key: 'last_interaction_date',
        header: t('pages.reports.lowVerification.columns.lastInteraction'),
        // Null for ~36 % of production rows (client never contacted yet) and
        // cut in UTC whatever timezone was requested — frozen card parity.
        render: (row) => formatCalendarDay(row.last_interaction_date, language),
      },
      {
        key: 'verified_count',
        header: t('pages.reports.lowVerification.columns.verifiedCount'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{formatNumber(row.verified_count, language)}</span>
        ),
      },
      {
        key: 'body_amount',
        header: t('pages.reports.lowVerification.columns.bodyAmount'),
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
