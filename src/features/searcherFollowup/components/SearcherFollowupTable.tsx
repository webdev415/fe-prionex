/**
 * SearcherFollowupTable Component
 *
 * «Серчер без відпрацювання» work list (8 columns) built on the shared
 * DataTable. One row = one CLIENT whose latest meaningful interaction is a
 * successful searcher find («Інформація знайдена») nobody has acted on.
 *
 * The component only formats and links. Rows arrive pre-sorted by
 * `department`, `group_name`, the responsible employee's LAST name, then
 * `client_id` (Card 123 parity; `client_id` load-bearing for stable
 * pagination over tied rows) — the order is fixed SERVER-side and there is
 * deliberately no client-side sorting UI: sorting one page of a
 * server-paginated feed would reorder 50 rows out of the whole feed and read
 * as a lie.
 *
 * `interaction_at` / `last_call_at` are absolute UTC instants (the API
 * deliberately dropped the card's baked-in `+3h` display shift) and are
 * formatted here in the user's PROFILE timezone via the shared
 * `formatDateTime` — never shifted by hand.
 *
 * The client link is built here from `client_id`: the Metabase card SELECTed
 * a ready-made `https://crm-prionex.online/dashboard/clients/<id>` URL, and
 * the API deliberately dropped it because a hardcoded host breaks on every
 * environment but production (docs/searcher-followup-feed.md).
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { resolveCallOutcomeDisplay } from '@/lib/feedCallOutcome'
import { formatDateTime } from '@/lib/formatters'
import type { SearcherFollowupRow } from '../types'

export interface SearcherFollowupTableProps {
  rows: SearcherFollowupRow[]
  /**
   * IANA timezone of the user's profile — the zone both datetime columns are
   * rendered in (falls back to browser-local when the profile has none,
   * matching the rest of the app's `formatDateTime` consumers).
   */
  timezone?: string | null
  /** Shown in the table body when the feed legitimately holds no rows. */
  emptyMessage: string
}

/** DataTable requires an `id`; one row is one client, so `client_id` is unique. */
type SearcherFollowupTableRow = SearcherFollowupRow & { id: number }

/** Placeholder for nullable columns (shared table convention). */
const EMPTY = '—'

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (SearcherFollowupFeedTab), so nobody counts the list by hand a second
 * time. It cannot be derived from `columns` at module scope: that array is
 * built inside the component because every header goes through `t`. The pair
 * is kept honest by a test asserting the rendered header count equals this
 * constant (__tests__/SearcherFollowupTable.test.tsx).
 */
export const SEARCHER_FOLLOWUP_COLUMN_COUNT = 8

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

export function SearcherFollowupTable({
  rows,
  timezone,
  emptyMessage,
}: SearcherFollowupTableProps) {
  const { t } = useTranslation('common')

  const data: SearcherFollowupTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.client_id })),
    [rows]
  )

  const columns: Column<SearcherFollowupTableRow>[] = useMemo(
    () => [
      {
        key: 'inn',
        header: t('pages.reports.searcherFollowup.columns.inn'),
        render: (row) => (
          <Link
            to={clientDetailsPath(row.client_id)}
            className="text-information-700 hover:underline"
            // A row without a tax id would otherwise be a link named "—".
            // With one, the accessible name stays the tax id itself.
            aria-label={
              row.inn
                ? undefined
                : t('pages.reports.searcherFollowup.openClient', { id: row.client_id })
            }
          >
            {row.inn ?? EMPTY}
          </Link>
        ),
      },
      {
        key: 'interaction_at',
        header: t('pages.reports.searcherFollowup.columns.foundAt'),
        // A full DATE+TIME in the profile timezone: two finds on the same day
        // are worked newest-context-first, so the time is not decoration.
        // Non-null by contract; formatDateTime still degrades to "—" rather
        // than crash if the payload ever breaks it.
        render: (row) => (
          <span className="tabular-nums">{formatDateTime(row.interaction_at, timezone)}</span>
        ),
      },
      {
        key: 'searcher_name',
        header: t('pages.reports.searcherFollowup.columns.searcher'),
        // Null when the interaction was written by an automated chain, not a
        // person — there is genuinely nobody to name.
        render: (row) => row.searcher_name ?? EMPTY,
      },
      {
        key: 'employee_name',
        header: t('pages.reports.searcherFollowup.columns.employee'),
        obscured: true,
        // Null for unassigned clients and employees without org context in
        // the project — kept on purpose: they need follow-up the most.
        render: (row) => row.employee_name ?? EMPTY,
      },
      {
        key: 'department',
        header: t('pages.reports.searcherFollowup.columns.department'),
        render: (row) => row.department ?? EMPTY,
      },
      {
        key: 'group_name',
        header: t('pages.reports.searcherFollowup.columns.group'),
        render: (row) => row.group_name ?? EMPTY,
      },
      {
        key: 'last_call_at',
        header: t('pages.reports.searcherFollowup.columns.lastCall'),
        // Null both when the pair was never called and when the responsible
        // employee has no telephony seat (~27 % of production rows).
        render: (row) =>
          row.last_call_at === null ? (
            EMPTY
          ) : (
            <span className="tabular-nums">{formatDateTime(row.last_call_at, timezone)}</span>
          ),
      },
      {
        key: 'last_call_outcome',
        header: t('pages.reports.searcherFollowup.columns.lastCallOutcome'),
        render: (row) => {
          const display = resolveCallOutcomeDisplay(row.last_call_at, row.last_call_outcome)
          switch (display.kind) {
            case 'none':
              return EMPTY
            case 'unknown':
              return t('pages.reports.searcherFollowup.outcome.unknown')
            case 'known':
              // The shared classifier's key/fallback pair — the same call the
              // call log and monitoring tables make (src/lib/callOutcome.ts).
              return t(display.labelKey, display.fallback)
            case 'raw':
              // A future telephony outcome the classifier has no label for:
              // verbatim beats "Unknown" (which means "no outcome recorded")
              // and infinitely beats a crash — see lib/feedCallOutcome.ts.
              return display.value
          }
        },
      },
    ],
    [t, timezone]
  )

  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} className="w-full" />
}
