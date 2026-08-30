/**
 * Department sub-tabs of the «Обіцянки по операторах» report.
 *
 * The backend deliberately applies NO department filter (docs/operator-promises-report.md,
 * deviation 7): it returns every department, including a null one, and the
 * frontend chooses its tabs. The card's `{{department}}` widget is never set by
 * its consumers, and Techno-Finance drops the "non-operator" departments on the
 * frontend instead — which loses money (Юристи + Аналітики + no-department held
 * ≈ 631 000 ₴ of July 2026 collections). Hence the «Всі» tab, which shows
 * EVERY row and is the DEFAULT: the whole picture first, everything else as
 * narrowing views.
 *
 * The strip has two halves, and they are built on different keys on purpose:
 *
 * 1. A FIXED triple — ТП, Дайлер, Стягнення — matched by department NAME and
 *    ALWAYS rendered, even for a response in which none of the three has a
 *    single row. They are the operator departments the business steers by, they
 *    are the three sub-tabs Techno-Finance's own «Обещания» panel carries
 *    («Общее» → ТП → Дайлер → Взыск, where «Взыск» is this report's
 *    «Стягнення»), and a strip whose shape changed with the period would make
 *    "ТП did nothing this week" indistinguishable from "ТП is gone". Matching
 *    them by name is a PRODUCT decision (Aleksey, 2026-08-20), not a fallback:
 *    these three tabs mean "the department currently called ТП", so a
 *    department renamed INTO «ТП» is what the ТП tab should show.
 *
 * 2. DYNAMIC department tabs — one per department present in the response whose
 *    NAME is none of the three, keyed by `department_id` (the stable key the
 *    contract gained on 2026-08-20) and LABELLED with the live name from the
 *    same rows, in locale-alphabetical order after the triple. Юристи,
 *    Аналітики and every department the directory grows next therefore get a
 *    tab of their own without a single line of code, and none of them is
 *    "other" in a bucket nobody can read.
 *
 * Rows whose `department_id` is null are visible ON «ВСІ» ONLY: there is no
 * stable key to build a tab around, and by contract a null id comes with a null
 * name, so the triple's name match cannot claim them either. That is the
 * no-department operator — the very row Techno-Finance loses — and «Всі» is
 * where their money is read.
 *
 * WHAT A RENAME NOW DOES (the reason `department_id` was asked for). Rename «ТП»
 * to «Технічна підтримка» in the auth directory and the next response carries
 * the SAME id under the NEW name: the fixed ТП tab goes empty and says so
 * (`emptyDepartment`, never "no data for the period"), and RIGHT NEXT TO IT a
 * dynamic «Технічна підтримка» tab appears carrying every row and every hryvnia.
 * Nothing is hidden and nothing is silently re-bucketed — the reader sees both
 * halves of the fact at once. Before the id existed, the money could only be
 * found by going back to «Всі».
 *
 * Three edges, all accepted (Aleksey, 2026-08-20), all stable rather than
 * clever:
 * - two departments sharing a name under different ids render as two tabs with
 *   the SAME label. Rare, and the alternative — merging them — would sum two
 *   different departments into one number;
 * - a department that is NOT the original ТП but is named «ТП» is shown by the
 *   fixed ТП tab (name match, see above) and gets no dynamic tab of its own,
 *   so its rows appear exactly once in the strip;
 * - when such an impostor coexists WITH the original — two departments named
 *   «ТП» under different ids — the one fixed tab claims BOTH (its rows and
 *   subtotals are their sum), and neither earns a dynamic tab. The fixed tabs
 *   cannot have the dynamic half's same-label duality: they match by name, so
 *   for them an identical name IS one tab. Only «Всі» and the rows themselves
 *   show that two departments are in play; a directory naming two departments
 *   identically is the fault to fix at the source.
 *
 * Filtering is CLIENT-side over the single response — one request serves every
 * tab, exactly as in Techno-Finance, and switching a tab is therefore cheap
 * enough for `activation="automatic"`.
 */

import type { OperatorPromisesRow } from '../api/types'

/**
 * The tabs that are ALWAYS in the strip, in display order: the aggregate first
 * (Techno-Finance's «Общее»), then the three operator departments. Ids are
 * stable — they travel in the URL (`?opd=`) and name the i18n label keys.
 */
export const OPERATOR_PROMISES_FIXED_TAB_IDS = ['all', 'tp', 'dialer', 'collection'] as const

export type OperatorPromisesFixedTabId = (typeof OPERATOR_PROMISES_FIXED_TAB_IDS)[number]

/**
 * A dynamic department tab's id: `d` + `department_id` (`d17`). The prefix is
 * what keeps the two halves of the strip from ever colliding — no department id
 * can spell `all`, `tp`, `dialer` or `collection`.
 */
export type OperatorPromisesDynamicTabId = `d${number}`

export type OperatorPromisesTabId = OperatorPromisesFixedTabId | OperatorPromisesDynamicTabId

/**
 * The default tab — the full picture, mirroring Techno-Finance's «Общее».
 * It is never written to the URL (see the tab component): an absent `?opd=`
 * means "all", so a shared link stays clean and cannot pin a choice nobody made.
 */
export const DEFAULT_OPERATOR_PROMISES_TAB: OperatorPromisesFixedTabId = 'all'

/**
 * Fixed tab id → the `department` string the backend emits. `all` maps to null:
 * it is not a department but the absence of a filter, so it also carries the
 * rows no other tab shows — the null department above all.
 */
const FIXED_TAB_DEPARTMENT: Record<OperatorPromisesFixedTabId, string | null> = {
  all: null,
  tp: 'ТП',
  dialer: 'Дайлер',
  collection: 'Стягнення',
}

/**
 * The three names the fixed tabs claim. Derived from the map above rather than
 * spelled out again, so a fourth fixed tab cannot end up with a dynamic twin.
 */
const FIXED_DEPARTMENT_NAMES: ReadonlySet<string> = new Set(
  Object.values(FIXED_TAB_DEPARTMENT).filter((name): name is string => name !== null)
)

/** Only `d` followed by digits: everything else is not an id this app minted. */
const DYNAMIC_TAB_ID_PATTERN = /^d\d+$/

/** URL/DOM id of the tab for `departmentId`. */
export function dynamicDepartmentTabId(departmentId: number): OperatorPromisesDynamicTabId {
  return `d${departmentId}`
}

/** The department id inside a `d17`-shaped tab id; null for any other string. */
function parseDynamicTabId(tabId: string): number | null {
  return DYNAMIC_TAB_ID_PATTERN.test(tabId) ? Number(tabId.slice(1)) : null
}

export function isFixedOperatorPromisesTab(tabId: string): tabId is OperatorPromisesFixedTabId {
  return (OPERATOR_PROMISES_FIXED_TAB_IDS as readonly string[]).includes(tabId)
}

/** One dynamic tab: a stable key, and the name the directory uses right now. */
export interface OperatorPromisesDepartmentTab {
  /** URL/DOM id — `d` + `departmentId`. */
  id: OperatorPromisesDynamicTabId
  /** The stable key rows are filtered by; survives every rename. */
  departmentId: number
  /** LIVE label, straight from the response — never a stored or translated name. */
  label: string
}

/**
 * The dynamic half of the strip, derived from the response itself: one tab per
 * `department_id` whose NAME is not one of the fixed three, sorted by that name
 * in the caller's locale (`localeCompare`, so Ukrainian orders as Ukrainian and
 * not by code point), ties broken by id so the order is total and stable.
 *
 * Skipped, and therefore readable on «Всі» only:
 * - a `department_id` that is not a non-negative integer — the no-department
 *   operator (null), and anything an id cannot be;
 * - a null or blank `department` — a tab needs a legible label, and the id
 *   alone ("d17") would name nothing to a reader.
 *
 * The FIRST name seen for an id wins. Rows arrive sorted by department name, and
 * one id carries one name in the directory, so this is a tie that should not
 * occur; resolving it deterministically beats letting the last row decide.
 */
export function collectDynamicDepartmentTabs(
  rows: readonly OperatorPromisesRow[],
  locale?: string
): OperatorPromisesDepartmentTab[] {
  const byDepartmentId = new Map<number, OperatorPromisesDepartmentTab>()

  for (const row of rows) {
    const departmentId = row.department_id
    const label = row.department
    // `typeof`, not `=== null`: a response from a backend older than the
    // contract has no `department_id` at all, and an `undefined` id would
    // otherwise mint a nonsense "dundefined" tab. A missing id is the same fact
    // as a null one — no stable key, so no tab, and the rows are read on «Всі».
    // The non-negative-integer bound is what keeps every minted id inside
    // `DYNAMIC_TAB_ID_PATTERN`, the shape `filterRowsByTab` can read back.
    if (typeof departmentId !== 'number' || !Number.isInteger(departmentId) || departmentId < 0)
      continue
    if (label === null || label.trim() === '') continue
    // Exact-name check, the same comparison `filterRowsByTab` makes for the
    // fixed tabs — so a name that only LOOKS like «ТП» (say with a trailing
    // space) is not swallowed by the fixed tab AND still earns its own.
    if (FIXED_DEPARTMENT_NAMES.has(label)) continue
    if (byDepartmentId.has(departmentId)) continue
    byDepartmentId.set(departmentId, {
      id: dynamicDepartmentTabId(departmentId),
      departmentId,
      label,
    })
  }

  return [...byDepartmentId.values()].sort(
    (a, b) => a.label.localeCompare(b.label, locale) || a.departmentId - b.departmentId
  )
}

/**
 * `?opd=` → the tab to show. A fixed id is always accepted; a dynamic one only
 * while the CURRENT response still has that department, which is what makes a
 * stale or hand-edited link degrade to «Всі» instead of an empty screen.
 *
 * The fallback is a pure derivation and is never written back to the URL: the
 * first render has no rows yet, so `d17` resolves to «Всі» for exactly as long
 * as the request is in flight and then snaps to its tab when the rows land. A
 * URL rewrite would have destroyed the deep link in that window. The same
 * silence applies when the user moves to a period in which the department has
 * no rows at all — the view preference stays in the URL and comes back with the
 * department.
 */
export function resolveOperatorPromisesTab(
  raw: string | null,
  dynamicTabs: readonly OperatorPromisesDepartmentTab[] = []
): OperatorPromisesTabId {
  if (raw === null) return DEFAULT_OPERATOR_PROMISES_TAB
  if (isFixedOperatorPromisesTab(raw)) return raw
  const match = dynamicTabs.find((tab) => tab.id === raw)
  return match ? match.id : DEFAULT_OPERATOR_PROMISES_TAB
}

/**
 * Rows visible on `tabId`. «Всі» returns the input array itself (same
 * reference, so a memo over it does not churn); a fixed department tab keeps the
 * exact-name matches; a dynamic one keeps the exact `department_id` matches,
 * which by construction excludes the null department from both.
 */
export function filterRowsByTab(
  rows: OperatorPromisesRow[],
  tabId: OperatorPromisesTabId
): OperatorPromisesRow[] {
  if (isFixedOperatorPromisesTab(tabId)) {
    const department = FIXED_TAB_DEPARTMENT[tabId]
    if (department === null) return rows
    return rows.filter((row) => row.department === department)
  }

  const departmentId = parseDynamicTabId(tabId)
  // Unreachable through `resolveOperatorPromisesTab`, which only ever returns a
  // tab that exists. Empty rather than everything: a filter that cannot be
  // applied must not silently widen into "no filter".
  if (departmentId === null) return []
  return rows.filter((row) => row.department_id === departmentId)
}
