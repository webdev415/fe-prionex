/**
 * InboundFollowupTable Component
 *
 * «Вхід без відпрацювання» work list (8 columns) built on the shared DataTable.
 * One row = one CLIENT whose latest interaction is a tech-support step parked
 * on «Очікує на зворотній зв'язок» — the client reached out, somebody was
 * supposed to call back, and nobody has recorded anything since.
 *
 * The column set is the source system's nine-column contact shape, shared with
 * the sibling Card 123 feed and rendered the same way: the ninth source column
 * is a ready-made client LINK, which is folded into the tax-id cell here (see
 * below), leaving eight rendered columns. Only the third differs between the
 * two feeds — «Причини звернення» here, «Серчер» there.
 *
 * The component only formats and links. Rows arrive pre-sorted by
 * `department`, `group_name`, the responsible employee's LAST name, then
 * `client_id` (Card 122 parity; `client_id` load-bearing for stable pagination
 * over tied rows) — the order is fixed SERVER-side and there is deliberately no
 * client-side sorting UI: sorting one page of a server-paginated feed would
 * reorder 50 rows out of the whole feed and read as a lie.
 *
 * `interaction_at` / `last_call_at` are absolute UTC instants (the API
 * deliberately dropped the card's baked-in `+3h` display shift) and are
 * formatted here in the user's PROFILE timezone via the shared
 * `formatDateTime` — never shifted by hand.
 *
 * BOTH call columns are empty on most rows and that is CORRECT: 89 % of this
 * feed's rows have a responsible employee with no telephony seat and 94 % have
 * no call at all (production probe, 2026-08-25). They render as the shared "—"
 * placeholder, exactly like any other missing value — there is no hint, banner
 * or empty-state of their own, because nothing is wrong.
 *
 * The client link is built here from `client_id`: the Metabase card SELECTed
 * a ready-made `https://crm-prionex.online/dashboard/clients/<id>` URL, and
 * the API deliberately dropped it because a hardcoded host breaks on every
 * environment but production (docs/inbound-followup-feed.md).
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { resolveCallOutcomeDisplay } from '@/lib/feedCallOutcome'
import { formatDateTime } from '@/lib/formatters'
import type { InboundFollowupRow } from '../types'

export interface InboundFollowupTableProps {
  rows: InboundFollowupRow[]
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
type InboundFollowupTableRow = InboundFollowupRow & { id: number }

/** Placeholder for nullable columns (shared table convention). */
const EMPTY = '—'

/**
 * Number of columns this table renders — the width every skeleton of it must
 * use (InboundFollowupFeedTab), so nobody counts the list by hand a second
 * time. It cannot be derived from `columns` at module scope: that array is
 * built inside the component because every header goes through `t`. The pair
 * is kept honest by a test asserting the rendered header count equals this
 * constant (__tests__/InboundFollowupTable.test.tsx).
 */
export const INBOUND_FOLLOWUP_COLUMN_COUNT = 8

/** Route of the client details page (`clients/:id` under /dashboard, src/routes). */
function clientDetailsPath(clientId: number): string {
  return `/dashboard/clients/${clientId}`
}

export function InboundFollowupTable({ rows, timezone, emptyMessage }: InboundFollowupTableProps) {
  const { t } = useTranslation('common')

  const data: InboundFollowupTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.client_id })),
    [rows]
  )

  const columns: Column<InboundFollowupTableRow>[] = useMemo(
    () => [
      {
        key: 'inn',
        header: t('pages.reports.inboundFollowup.columns.inn'),
        render: (row) => (
          <Link
            to={clientDetailsPath(row.client_id)}
            className="text-information-700 hover:underline"
            // A row without a tax id would otherwise be a link named "—".
            // With one, the accessible name stays the tax id itself.
            aria-label={
              row.inn
                ? undefined
                : t('pages.reports.inboundFollowup.openClient', { id: row.client_id })
            }
          >
            {row.inn ?? EMPTY}
          </Link>
        ),
      },
      {
        key: 'interaction_at',
        header: t('pages.reports.inboundFollowup.columns.interactionAt'),
        // A full DATE+TIME in the profile timezone: several requests on the
        // same day are worked oldest-first, so the time is not decoration.
        // Non-null by contract; formatDateTime still degrades to "—" rather
        // than crash if the payload ever breaks it.
        render: (row) => (
          <span className="tabular-nums">{formatDateTime(row.interaction_at, timezone)}</span>
        ),
      },
      {
        key: 'interaction_type',
        // The source system's column header is the PLURAL «Причини звернення»
        // even though the target action behind the value is named in the
        // singular — the header follows the card the operators know.
        header: t('pages.reports.inboundFollowup.columns.interactionType'),
        // Null when the interaction's step_data carries no type entry.
        render: (row) => row.interaction_type ?? EMPTY,
      },
      {
        key: 'employee_name',
        header: t('pages.reports.inboundFollowup.columns.employee'),
        // Null for unassigned clients and employees without org context in
        // the project — kept on purpose: they need follow-up the most.
        render: (row) => row.employee_name ?? EMPTY,
      },
      {
        key: 'department',
        header: t('pages.reports.inboundFollowup.columns.department'),
        // Empty on 79 % of production rows — roles without a department_id,
        // not a broken join (probe 2026-08-25).
        render: (row) => row.department ?? EMPTY,
      },
      {
        key: 'group_name',
        header: t('pages.reports.inboundFollowup.columns.group'),
        render: (row) => row.group_name ?? EMPTY,
      },
      {
        key: 'last_call_at',
        header: t('pages.reports.inboundFollowup.columns.lastCall'),
        // Null both when the pair was never called and when the responsible
        // employee has no telephony seat — the majority of rows here (94 % of
        // production rows have no call at all). An expected blank, not a gap.
        render: (row) =>
          row.last_call_at === null ? (
            EMPTY
          ) : (
            <span className="tabular-nums">{formatDateTime(row.last_call_at, timezone)}</span>
          ),
      },
      {
        key: 'last_call_outcome',
        header: t('pages.reports.inboundFollowup.columns.lastCallOutcome'),
        render: (row) => {
          const display = resolveCallOutcomeDisplay(row.last_call_at, row.last_call_outcome)
          switch (display.kind) {
            case 'none':
              return EMPTY
            case 'unknown':
              return t('pages.reports.inboundFollowup.outcome.unknown')
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
