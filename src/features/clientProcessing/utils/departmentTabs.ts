/**
 * Department sub-tab construction for the processing report.
 *
 * Tabs are keyed by `department_id`, not by the (Cyrillic, renameable)
 * `department_name` — the name is only used to match the known display
 * overlay (slug + i18n label) and as the label for unknown departments.
 *
 * The three known departments come first in canonical order
 * (ТП → Дайлер → Стягнення) and are always shown so the strip stays stable
 * while data loads; any other departments found in the rows are appended
 * after them (in order of first appearance). Rows without a department name
 * get their own «—» tab at the end, so they are never lost.
 */

import type { DepartmentTabDef, ProcessingReportRow } from '../types'
import { KNOWN_DEPARTMENTS } from '../types'

const KNOWN_BY_NAME = new Map(KNOWN_DEPARTMENTS.map((known) => [known.name, known]))

/** Tab id for rows without a department name. */
export const NO_DEPARTMENT_TAB_ID = 'none'

/** Label shown for rows without a department. */
export const NO_DEPARTMENT_LABEL = '—'

/**
 * The sub-tab a row belongs to. Used both to build the tab strip and to
 * filter rows, so membership can never drift between the two.
 */
export function rowDepartmentTabId(row: ProcessingReportRow): string {
  const name = row.department_name
  // == null also catches undefined from a loose payload; an empty-string
  // name would make a tab without an accessible name — treat it as missing.
  if (name == null || name === '') return NO_DEPARTMENT_TAB_ID
  const known = KNOWN_BY_NAME.get(name)
  if (known) return known.slug
  // Unknown departments are keyed by numeric id; the name fallback covers
  // the contract edge where enrichment supplied a name without an id. The
  // name is percent-encoded because tab ids become DOM ids / IDREFs
  // (aria-labelledby) where spaces are illegal — encoding is injective, so
  // distinct names can't collide the way slugification could.
  return row.department_id !== null ? String(row.department_id) : `name-${encodeURIComponent(name)}`
}

export function buildDepartmentTabs(rows: ProcessingReportRow[]): DepartmentTabDef[] {
  const tabs: DepartmentTabDef[] = KNOWN_DEPARTMENTS.map((known) => ({
    id: known.slug,
    labelKey: known.labelKey,
  }))
  const seen = new Set(tabs.map((tab) => tab.id))
  let noneTab: DepartmentTabDef | null = null

  for (const row of rows) {
    const id = rowDepartmentTabId(row)
    if (seen.has(id)) continue
    seen.add(id)
    if (id === NO_DEPARTMENT_TAB_ID) {
      noneTab = { id, label: NO_DEPARTMENT_LABEL }
    } else {
      tabs.push({ id, label: row.department_name ?? NO_DEPARTMENT_LABEL })
    }
  }

  // «—» always renders last, after known and unknown departments
  if (noneTab) tabs.push(noneTab)
  return tabs
}

/**
 * Resolve the active tab from the raw `?dept=` URL value. Without an explicit
 * (and valid) selection, prefer the first tab that actually has rows — the
 * known tabs are always rendered, so blindly defaulting to ТП could open an
 * empty tab while the data lives elsewhere. Falls back to the first tab.
 */
export function resolveActiveDepartmentTab(
  tabs: DepartmentTabDef[],
  rawDept: string | null,
  rows: ProcessingReportRow[]
): DepartmentTabDef {
  if (rawDept) {
    const explicit = tabs.find((tab) => tab.id === rawDept)
    if (explicit) return explicit
  }
  const nonEmptyIds = new Set(rows.map(rowDepartmentTabId))
  return tabs.find((tab) => nonEmptyIds.has(tab.id)) ?? tabs[0]
}
