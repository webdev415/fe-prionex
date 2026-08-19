/**
 * Department sub-tabs of the «Обіцянки по операторах» report.
 *
 * The backend deliberately applies NO department filter (docs/operator-promises-report.md,
 * deviation 7): it returns every department, including a null one, and the
 * frontend chooses its tabs. The card's `{{department}}` widget is never set by
 * its consumers, and Techno-Finance drops the "non-operator" departments on the
 * frontend instead — which loses money (Юристи + Аналітики + no-department held
 * ≈ 631 000 ₴ of July 2026 collections). Hence the «Всі» tab, which shows
 * EVERY row and is the DEFAULT: the whole picture first, the three operator
 * departments as narrowing views.
 *
 * Tab order and default follow Techno-Finance's own panel, where the aggregate
 * sub-tab («Общее») comes first and is what an unset `?subtab=` resolves to,
 * followed by ТП → Дайлер → Взыск. «Взыск» there is this report's «Стягнення»
 * (the card emits the Ukrainian name; TF only relabels it in the UI).
 *
 * Filtering is CLIENT-side over the single response — one request serves all
 * four tabs, exactly as in Techno-Finance, and switching a tab is therefore
 * cheap enough for `activation="automatic"`.
 *
 * MATCHING BY NAME is a contract limitation, not a preference: the response
 * carries `department` as a display STRING and no department id (the auth
 * directory's org-context batch was left untouched by this migration). The
 * usual rule "key UI by id, never by a displayed string" cannot be applied
 * until the contract grows an id — renaming a department in the directory would
 * silently empty its tab here. The «Всі» tab is the safety net: it never
 * filters, so no row can become unreachable, and its own totals are shown next
 * to the backend's period totals, which makes a drifted name visible as a gap
 * between the two numbers.
 */

import type { OperatorPromisesRow } from '../api/types'

/** Stable ids used in the URL (`?opd=`) and for the i18n label keys. */
export const OPERATOR_PROMISES_TAB_IDS = ['all', 'tp', 'dialer', 'collection'] as const

export type OperatorPromisesTabId = (typeof OPERATOR_PROMISES_TAB_IDS)[number]

/**
 * The default tab — the full picture, mirroring Techno-Finance's «Общее».
 * It is never written to the URL (see the tab component): an absent `?opd=`
 * means "all", so a shared link stays clean and cannot pin a choice nobody made.
 */
export const DEFAULT_OPERATOR_PROMISES_TAB: OperatorPromisesTabId = 'all'

/**
 * Tab id → the `department` string the backend emits. `all` maps to null: it is
 * not a department but the absence of a filter, so it also carries the rows the
 * three operator tabs never show — Юристи, Аналітики and the null department.
 */
const TAB_DEPARTMENT: Record<OperatorPromisesTabId, string | null> = {
  all: null,
  tp: 'ТП',
  dialer: 'Дайлер',
  collection: 'Стягнення',
}

/** Unknown/absent `?opd=` values fall back to the default tab. */
export function resolveOperatorPromisesTab(raw: string | null): OperatorPromisesTabId {
  return OPERATOR_PROMISES_TAB_IDS.includes(raw as OperatorPromisesTabId)
    ? (raw as OperatorPromisesTabId)
    : DEFAULT_OPERATOR_PROMISES_TAB
}

/**
 * Rows visible on `tabId`. «Всі» returns the input array itself (same
 * reference, so a memo over it does not churn); a department tab keeps the
 * exact-name matches only, which by construction excludes the null department.
 */
export function filterRowsByTab(
  rows: OperatorPromisesRow[],
  tabId: OperatorPromisesTabId
): OperatorPromisesRow[] {
  const department = TAB_DEPARTMENT[tabId]
  if (department === null) return rows
  return rows.filter((row) => row.department === department)
}
