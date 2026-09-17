/**
 * PromisesDailyTable Component
 *
 * «Обіцянки до кінця місяця» day × department matrix (migrated Metabase Card
 * 103): one row per calendar DAY of the window, one money column per
 * department plus a «Разом» column, and a final totals row over the whole
 * period.
 *
 * The table is hand-rolled rather than built on the shared DataTable because
 * its shape is a matrix, not a record list: the column set is data-driven (one
 * per department of the response), the day column doubles as the row header,
 * and the totals row is a real `tfoot` — none of which DataTable models. The
 * cell styling mirrors DataTable's so the two read as siblings on the page.
 *
 * The row axis is the response's own `dates` — a CONTINUOUS day axis the
 * backend guarantees (zero-days included), so nothing is filtered or filled
 * here. Departments render in the server's order; a NULL department name is a
 * real series (promises taken by operators with no department carry real
 * money) and renders under the localized «Без відділу» label instead of being
 * dropped.
 *
 * The per-day «Разом» cell is the ONE client-side summation (the contract
 * ships no per-day total — see utils/totals.ts); the per-department totals and
 * the grand total in the footer are the server's own exact-Decimal sums,
 * rendered verbatim.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { parsePickerYMD } from '@/lib/dateUtils'
import { formatDate } from '@/lib/localeFormat'
import type { PromisesDailyDepartment } from '../types'
import { formatMoney } from '../utils/format'
import { sumDepartmentsByDay } from '../utils/totals'

export interface PromisesDailyTableProps {
  /** Continuous YYYY-MM-DD day axis from the response. */
  dates: string[]
  /** Departments in the server's order; a null name is the no-department series. */
  departments: PromisesDailyDepartment[]
  /** The server's grand total over every department and every day. */
  total: string | number
  /** Shown when the window legitimately produced no promises at all. */
  emptyMessage: string
}

const HEADER_CELL = 'border-border bg-card h-[49px] border-b px-4 text-xs font-semibold'
const BODY_CELL = 'text-foreground h-[49px] px-4 text-xs font-medium whitespace-nowrap'
const FOOTER_CELL =
  'border-border bg-card text-foreground h-[49px] border-t px-4 text-xs font-semibold whitespace-nowrap'

export function PromisesDailyTable({
  dates,
  departments,
  total,
  emptyMessage,
}: PromisesDailyTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const dayTotals = useMemo(
    () => sumDepartmentsByDay(departments, dates.length),
    [departments, dates.length]
  )

  // "Nobody promised anything for the window" is a normal 200 — the backend
  // then has no series to ship, and a matrix of empty columns would claim a
  // structure the answer does not have.
  const isEmpty = dates.length === 0 || departments.length === 0

  return (
    <div className="data-table-scroll border-border bg-border w-full overflow-x-auto rounded-xl border pb-2 shadow-sm">
      <table className="min-w-full border-collapse whitespace-nowrap">
        <thead>
          <tr className="bg-card">
            <th
              scope="col"
              className={`${HEADER_CELL} border-border text-foreground border-r text-left`}
            >
              {t('pages.reports.promisesDaily.columns.date')}
            </th>
            {/* Position IS the identity of a series (`values` aligns with the
                day axis by index, and the server may legitimately ship two
                departments under the same name), so the index is the honest
                React key — a name-based key would collide on duplicates. Same
                in the body and footer loops below. */}
            {departments.map((department, index) => (
              <th
                key={index}
                scope="col"
                className={`${HEADER_CELL} border-border text-foreground border-r text-right`}
              >
                {/* Blank counts as missing, not as a name: the auth-service
                    directory yields whitespace rather than null for an
                    unfilled entry (same reason orgLabel in
                    src/features/outboundCalls/utils/format.ts trims), and
                    `?? t(...)` alone would render an empty header. */}
                {department.name?.trim()
                  ? department.name
                  : t('pages.reports.promisesDaily.columns.noDepartment')}
              </th>
            ))}
            <th scope="col" className={`${HEADER_CELL} text-foreground text-right`}>
              {t('pages.reports.promisesDaily.columns.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td
                colSpan={departments.length + 2}
                className="text-foreground h-[49px] px-4 text-center text-xs font-medium"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            dates.map((date, dayIndex) => (
              <tr key={date} className={dayIndex % 2 === 0 ? 'bg-muted' : 'bg-card'}>
                <th scope="row" className={`${BODY_CELL} border-border border-r text-left`}>
                  {/* Rebuilt from its local Y/M/D parts: `new Date("YYYY-MM-DD")`
                      reads the axis day as UTC midnight, which renders as the
                      PREVIOUS day in any browser zone west of Greenwich. */}
                  {formatDate(parsePickerYMD(date) ?? date, language)}
                </th>
                {departments.map((department, index) => (
                  <td
                    key={index}
                    className={`${BODY_CELL} border-border border-r text-right tabular-nums`}
                  >
                    {formatMoney(department.values[dayIndex], language)}
                  </td>
                ))}
                <td className={`${BODY_CELL} text-right font-semibold tabular-nums`}>
                  {formatMoney(dayTotals[dayIndex], language)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {!isEmpty && (
          <tfoot>
            <tr>
              <th scope="row" className={`${FOOTER_CELL} border-border border-r text-left`}>
                {t('pages.reports.promisesDaily.totalsRow')}
              </th>
              {departments.map((department, index) => (
                <td
                  key={index}
                  className={`${FOOTER_CELL} border-border border-r text-right tabular-nums`}
                >
                  {formatMoney(department.total, language)}
                </td>
              ))}
              <td className={`${FOOTER_CELL} text-right tabular-nums`}>
                {formatMoney(total, language)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
