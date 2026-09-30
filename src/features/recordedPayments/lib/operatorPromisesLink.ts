/**
 * The link from an operator's name to the «Обіцянки по операторах» tab
 * (card 102) — acceptance criterion Q7 of Tasks/Kanbanboard#29, re-targeted:
 * the card-91 report the criterion originally named is not ported (blocked),
 * and the operator-promises row already carries a `user_id`, so the link
 * points there, BY ID, with the SAME window.
 *
 * The target is the same page (`/dashboard/reports`) with a different `?tab=`,
 * so the link is built from the CURRENT query string rather than from
 * scratch: the host page keeps every tab's params in the URL at once, and a
 * link that replaced them would throw this tab's own filters away on the way
 * over — Back would then land on a reset payments list. Only the
 * operator-promises tab's keys are written: the window (`opf`/`opt`), the
 * user (`opu`), and its department sub-tab (`opd`) is REMOVED so «Всі» —
 * the one sub-tab that filters nothing — is what shows the operator's row.
 * A department left over from an earlier visit could hide exactly the row
 * the link exists to show.
 */

import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'

/** Route of the Reports page (`reports` under /dashboard, src/routes). */
export const REPORTS_PATH = '/dashboard/reports'

/** The `?tab=` value of the operator-promises tab (ReportsDashboardPage's `REPORT_TABS`). */
export const OPERATOR_PROMISES_TAB = 'operator-promises'

export interface OperatorPromisesLinkInput {
  userId: number
  /** The window as APPLIED — the response echo, not the fields' raw text. */
  dateFrom: string
  dateTo: string
  /** The page's current query string, carried over so no sibling tab loses its state. */
  currentSearch: URLSearchParams
}

/** A react-router `to` object: the reports path plus the composed query string. */
export function operatorPromisesLink({
  userId,
  dateFrom,
  dateTo,
  currentSearch,
}: OperatorPromisesLinkInput): { pathname: string; search: string } {
  const next = new URLSearchParams(currentSearch)
  next.set(REPORTS_URL_KEYS.host.tab, OPERATOR_PROMISES_TAB)
  next.set(REPORTS_URL_KEYS.operatorPromises.dateFrom, dateFrom)
  next.set(REPORTS_URL_KEYS.operatorPromises.dateTo, dateTo)
  next.set(REPORTS_URL_KEYS.operatorPromises.user, String(userId))
  next.delete(REPORTS_URL_KEYS.operatorPromises.department)
  return { pathname: REPORTS_PATH, search: `?${next.toString()}` }
}
