/**
 * OperatorBreakdown Component
 *
 * The per-operator breakdown of the «Внесені платежі» selection — count and
 * sum per client's RESPONSIBLE employee (key B), over the WHOLE filtered
 * selection, never the page. This block is the tab's drill-down: it is what
 * the source system's per-operator KPI table is to its popup, and clicking a
 * line applies that operator as the filter (`rpu`), which is the one
 * navigation the acceptance criteria name.
 *
 * THREE KINDS OF LINE, none of them dropped:
 *  - an ordinary operator — a button that filters to them, and a link to
 *    their operator-promises row (same window, `opu=<user_id>`);
 *  - the SERVICE account («Договор закрыт », `is_service`) — an ordinary line
 *    with a text badge, filterable like any other. It holds 35 % of a month's
 *    rows on this axis; hiding or merging it would make the lines stop adding
 *    up to the summary (decision Q8);
 *  - the NULL line (`user_id: null`) — payments whose client the directory
 *    did not resolve. Kept so the lines still add up, but it cannot be
 *    filtered on (there is no id), so it is plain text.
 *
 * TWO NOTICES REPLACE NUMBERS RATHER THAN DECORATE THEM. `breakdown_capped`
 * means the window held more distinct clients than the feed resolves
 * responsibles for: the breakdown is EMPTY, and an empty table would read as
 * "nobody collected anything" — so the block renders the notice INSTEAD of
 * the table, and the operator filter is unavailable (the backend refuses it
 * with 400 on such a window anyway). `breakdown_truncated` means only the top
 * 500 lines by amount are here: the lines are shown, with a notice that the
 * list is not the whole axis, so the reader does not add them up expecting the
 * summary.
 *
 * THE NAME IS TEXT INSIDE THE MARKED CELL, AND NOWHERE ELSE. The name cell
 * carries `data-openreplay-obscured` (the same per-cell mark DataTable puts on
 * an `obscured` column), and OpenReplay masks the TEXT NODES under it — but it
 * never masks attributes, so a `title` or `aria-label` holding the name would
 * reach the recording verbatim from that very cell. The filter button and the
 * «→» link therefore get their accessible names from visually-hidden text
 * (`sr-only`) inside the cell, never from an attribute; the numbers cells are
 * left readable in a replay. `BreakdownLine` renders the name only under the
 * marked `<td>`. The static audit (`npm run pii-audit -- --check`) does not see
 * the name here (it is read outside the JSX), so it cannot guard this cell; the
 * guard is the DOM-level test over the rendered tab,
 * `__tests__/RecordedPaymentsTab.piiMasking.test.tsx`.
 */

import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { formatMoneyAmount, formatNumber } from '@/lib/localeFormat'
import { piiProps } from '@/lib/openreplay/pii'
import { operatorPromisesLink } from '../lib/operatorPromisesLink'
import type { OperatorBreakdownLine } from '../types'

export interface OperatorBreakdownProps {
  lines: OperatorBreakdownLine[]
  capped: boolean
  truncated: boolean
  /** The window as APPLIED (the response echo), carried into the operator links. */
  dateFrom: string
  dateTo: string
  /** The ids currently filtered on — their lines are marked as active. */
  selectedUserIds: number[]
  /** Apply one operator as the filter (`rpu`). */
  onSelectOperator: (userId: number) => void
  /** Drop the operator filter. Rendered only while one is applied. */
  onClearOperators: () => void
}

/** Blank counts as missing, not as content. */
function hasText(value: string | null): value is string {
  return !!value && value.trim() !== ''
}

interface BreakdownLineProps {
  line: OperatorBreakdownLine
  isActive: boolean
  dateFrom: string
  dateTo: string
  currentSearch: URLSearchParams
  onSelectOperator: (userId: number) => void
}

/**
 * One line of the breakdown. A component of its own so that the operator's
 * name is rendered only UNDER the marked `<td>`; the piiMasking test, not the
 * static audit, is what fails if the mark is removed.
 */
function BreakdownLine({
  line,
  isActive,
  dateFrom,
  dateTo,
  currentSearch,
  onSelectOperator,
}: BreakdownLineProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  // The name, the id of a soft-deleted employee, or the wording for the
  // unresolved line — read ONLY inside the obscured cell below.
  const name = hasText(line.full_name)
    ? line.full_name
    : line.user_id == null
      ? t('pages.reports.recordedPayments.breakdown.unresolved')
      : String(line.user_id)

  return (
    <tr
      data-testid="recorded-payments-breakdown-line"
      data-service={line.is_service ? 'true' : undefined}
      data-active={isActive ? 'true' : undefined}
      className={`border-border border-t ${isActive ? 'bg-information-50' : ''}`}
    >
      <td className="text-foreground py-1.5 pr-4" {...piiProps}>
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          {line.user_id == null ? (
            <span className="text-muted-foreground">{name}</span>
          ) : (
            <button
              type="button"
              onClick={() => onSelectOperator(line.user_id as number)}
              aria-pressed={isActive}
              className={`text-left hover:underline ${
                line.is_service ? 'text-muted-foreground' : 'text-foreground'
              }`}
            >
              {/* The sentence with the name is TEXT (masked), not an
                  `aria-label` (never masked); the visible name is hidden from
                  assistive tech so the name is not read twice. */}
              <span aria-hidden="true">{name}</span>
              <span className="sr-only">
                {t('pages.reports.recordedPayments.breakdown.filter', { name })}
              </span>
            </button>
          )}
          {line.is_service && (
            // Text, not colour: the muted name alone would be
            // invisible to a screen reader.
            <span className="border-border text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
              {t('pages.reports.recordedPayments.serviceBadge')}
            </span>
          )}
          {line.user_id != null && (
            <Link
              to={operatorPromisesLink({
                userId: line.user_id,
                dateFrom,
                dateTo,
                currentSearch,
              })}
              className="text-information-700 text-[11px] hover:underline"
            >
              <span aria-hidden="true">→</span>
              <span className="sr-only">
                {t('pages.reports.recordedPayments.operatorPromisesLink', { name })}
              </span>
            </Link>
          )}
        </span>
      </td>
      <td className="text-foreground py-1.5 pr-4 text-right tabular-nums">
        {formatNumber(line.rows_count, language)}
      </td>
      <td className="text-foreground py-1.5 text-right tabular-nums">
        {formatMoneyAmount(line.amount, language)}
      </td>
    </tr>
  )
}

export function OperatorBreakdown({
  lines,
  capped,
  truncated,
  dateFrom,
  dateTo,
  selectedUserIds,
  onSelectOperator,
  onClearOperators,
}: OperatorBreakdownProps) {
  const { t } = useTranslation('common')
  const [searchParams] = useSearchParams()

  const hasFilter = selectedUserIds.length > 0

  return (
    <section
      aria-label={t('pages.reports.recordedPayments.breakdown.title')}
      className="bg-card flex w-full flex-col gap-3 rounded-xl p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-medium">
          {t('pages.reports.recordedPayments.breakdown.title')}
        </h2>
        {hasFilter && (
          <button
            type="button"
            onClick={onClearOperators}
            className="text-information-700 text-xs font-medium hover:underline"
          >
            {t('pages.reports.recordedPayments.breakdown.clearFilter')}
          </button>
        )}
      </div>

      {capped ? (
        // The notice INSTEAD of numbers: an empty breakdown is not "nobody".
        <p
          role="status"
          data-testid="recorded-payments-breakdown-capped"
          className="text-warning-700 text-xs font-medium"
        >
          {t('pages.reports.recordedPayments.breakdown.capped')}
        </p>
      ) : (
        <>
          {truncated && (
            <p
              role="status"
              data-testid="recorded-payments-breakdown-truncated"
              className="text-warning-700 text-xs font-medium"
            >
              {t('pages.reports.recordedPayments.breakdown.truncated', { count: lines.length })}
            </p>
          )}
          {lines.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {t('pages.reports.recordedPayments.breakdown.empty')}
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th scope="col" className="py-1 pr-4 font-medium">
                      {t('pages.reports.recordedPayments.breakdown.operator')}
                    </th>
                    <th scope="col" className="py-1 pr-4 text-right font-medium">
                      {t('pages.reports.recordedPayments.breakdown.count')}
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      {t('pages.reports.recordedPayments.breakdown.amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <BreakdownLine
                      key={line.user_id ?? `unresolved-${index}`}
                      line={line}
                      isActive={line.user_id != null && selectedUserIds.includes(line.user_id)}
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                      currentSearch={searchParams}
                      onSelectOperator={onSelectOperator}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
