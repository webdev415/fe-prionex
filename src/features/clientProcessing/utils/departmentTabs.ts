/**
 * Department sub-tab construction for the processing report.
 *
 * Tabs are built dynamically from the distinct `department_name` values of
 * the response: known departments come first in canonical order
 * (ТП → Дайлер → Стягнення) and are always shown so the strip stays stable
 * while data loads; any other department names found in the rows are
 * appended after them (in order of first appearance) with their raw name as
 * the label.
 */

import type { DepartmentTabDef, ProcessingReportRow } from '../types'
import { KNOWN_DEPARTMENT_TABS } from '../types'

export function buildDepartmentTabs(rows: ProcessingReportRow[]): DepartmentTabDef[] {
  const knownNames = new Set(KNOWN_DEPARTMENT_TABS.map((tab) => tab.departmentName))
  const extras: DepartmentTabDef[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const name = row.department_name
    if (!name || knownNames.has(name) || seen.has(name)) continue
    seen.add(name)
    extras.push({ id: name, departmentName: name })
  }

  return [...KNOWN_DEPARTMENT_TABS, ...extras]
}

/** Resolve the active tab from the raw `?dept=` URL value (fallback: first tab). */
export function resolveActiveDepartmentTab(
  tabs: DepartmentTabDef[],
  rawDept: string | null
): DepartmentTabDef {
  return tabs.find((tab) => tab.id === rawDept) ?? tabs[0]
}
