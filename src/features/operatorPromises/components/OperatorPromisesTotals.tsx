/**
 * OperatorPromisesTotals Component
 *
 * The report's summary block: one «показник → значення» table, as in
 * Techno-Finance's `PromisesTotals`, but with TWO value columns instead of one
 * table per department.
 *
 * - the first column totals the rows the active department sub-tab actually
 *   SHOWS (recomputed client-side — the backend deliberately ships no
 *   per-department subtotal);
 * - the second is the backend's own `totals` block for the WHOLE period, every
 *   department and every dismissed operator included.
 *
 * Both are always shown, side by side, and that is the point: a department tab
 * must never read as "this is the whole period", and on the «Всі» tab the two
 * columns are a live reconciliation of the client-side arithmetic against the
 * server's exact-Decimal one. A gap there is a real signal — a department name
 * that drifted in the auth directory, for instance, would show up as one.
 *
 * Both conversions are RATIOS in both columns and are therefore recomputed from
 * the summed money on each side (`Σ paid / Σ sum_to`), never averaged; "—"
 * means nothing was due, which is undefined rather than zero.
 *
 * The metrics are listed in the table's own column order, verified pair
 * included, so a reader moving between the two blocks reads the same sequence.
 *
 * Dismissed operators are NOT marked here. They are marked on their row, where
 * the mark means something; a total is a sum of money and has no employment
 * status.
 */

import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/localeFormat'
import type { OperatorPromisesTotals as OperatorPromisesTotalsData } from '../types'
import { formatConversion, formatCount, formatMoney } from '../utils/format'

export interface OperatorPromisesTotalsProps {
  /** Totals over the rows the active sub-tab shows (client-side recomputation). */
  visible: OperatorPromisesTotalsData
  /** The backend's totals over every row of the response. */
  overall: OperatorPromisesTotalsData
  /** Label of the active sub-tab — the heading of the "visible" column. */
  visibleLabel: string
  /** When the numbers were COMPUTED (server-side cache TTL is 15 minutes). */
  generatedAt: string
  /**
   * IANA zone the stamp is rendered in — the user's PROFILE timezone, the same
   * one that travels to the API and cuts the report's window. The browser zone
   * would make the stamp disagree with the period the numbers cover (an
   * operator abroad, or a machine clock set to UTC, reads a different hour for
   * the same instant); absent, it degrades to the browser zone.
   */
  timezone?: string | null
}

const CELL = 'px-3 py-1.5 text-right tabular-nums'
const LABEL_CELL = 'text-muted-foreground px-3 py-1.5 text-left font-normal'

export function OperatorPromisesTotals({
  visible,
  overall,
  visibleLabel,
  generatedAt,
  timezone,
}: OperatorPromisesTotalsProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const rows: Array<{
    key: string
    label: string
    render: (v: OperatorPromisesTotalsData) => string
  }> = [
    {
      key: 'operators',
      label: t('pages.reports.operatorPromises.totals.operators'),
      render: (v) => formatCount(v.operators, language),
    },
    {
      key: 'interactions',
      label: t('pages.reports.operatorPromises.columns.interactions'),
      render: (v) => formatCount(v.interactions_count, language),
    },
    {
      key: 'sum_from',
      label: t('pages.reports.operatorPromises.columns.sumFrom'),
      render: (v) => formatMoney(v.sum_from, language),
    },
    {
      key: 'sum_to',
      label: t('pages.reports.operatorPromises.columns.sumTo'),
      render: (v) => formatMoney(v.sum_to, language),
    },
    {
      key: 'paid_full',
      label: t('pages.reports.operatorPromises.columns.paidFull'),
      render: (v) => formatMoney(v.paid_full, language),
    },
    // Same two-trio order as the table columns: full-payment trio first,
    // then the verified trio (TF's two-level header, decision 2026-08-19).
    {
      key: 'unpaid',
      label: t('pages.reports.operatorPromises.columns.unpaid'),
      render: (v) => formatMoney(v.unpaid, language),
    },
    {
      key: 'conversion',
      label: t('pages.reports.operatorPromises.columns.conversion'),
      render: (v) => formatConversion(v.conversion, language),
    },
    {
      key: 'paid_verified',
      label: t('pages.reports.operatorPromises.columns.paidVerified'),
      render: (v) => formatMoney(v.paid_verified, language),
    },
    {
      key: 'verified_unpaid',
      label: t('pages.reports.operatorPromises.columns.unpaidVerified'),
      render: (v) => formatMoney(v.verified_unpaid, language),
    },
    {
      key: 'verified_conversion',
      label: t('pages.reports.operatorPromises.columns.conversionVerified'),
      render: (v) => formatConversion(v.verified_conversion, language),
    },
  ]

  return (
    <section className="bg-card w-full rounded-xl p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-foreground text-sm font-medium">
          {t('pages.reports.operatorPromises.totals.title')}
        </h3>
        {/* The answer may be up to 15 minutes old (worker-local cache), and
            `generated_at` is stamped when the numbers were computed — so it is
            shown rather than implied. Rendered in the PROFILE timezone, the one
            that cut the window, not in whatever zone the browser happens to be
            in. */}
        <p className="text-muted-foreground text-xs">
          {t('pages.reports.operatorPromises.totals.generatedAt', {
            value: formatDateTime(generatedAt, language, timezone),
          })}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-xs sm:text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className={LABEL_CELL} scope="col">
                <span className="sr-only">
                  {t('pages.reports.operatorPromises.totals.metricAria')}
                </span>
              </th>
              <th className="px-3 py-1.5 text-right font-medium" scope="col">
                {visibleLabel}
              </th>
              <th className="px-3 py-1.5 text-right font-medium" scope="col">
                {t('pages.reports.operatorPromises.totals.overall')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-border border-t">
                <th className={LABEL_CELL} scope="row">
                  {row.label}
                </th>
                <td className={`${CELL} text-foreground font-medium`}>{row.render(visible)}</td>
                <td className={`${CELL} text-muted-foreground`}>{row.render(overall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
