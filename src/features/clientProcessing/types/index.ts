/**
 * Client Processing Report Types
 *
 * UI-level types for the "Відпрацювання за ЦД" report tab.
 */

export type {
  ProcessingReportParams,
  ProcessingReportRow,
  ProcessingReportResponse,
} from '../api/types'

/** Department sub-tab ids (stable, URL-safe; labels come from i18n). */
export const PROCESSING_DEPARTMENT_TABS = ['tp', 'dialer', 'collection'] as const

export type ProcessingDepartmentTab = (typeof PROCESSING_DEPARTMENT_TABS)[number]

/**
 * Sub-tab → backend `department_name` value. The backend stores department
 * names in Ukrainian ("Стягнення" is shown as «Взыск» in the TF reference UI),
 * so the filter compares against those exact strings.
 */
export const PROCESSING_TAB_TO_DEPARTMENT: Record<ProcessingDepartmentTab, string> = {
  tp: 'ТП',
  dialer: 'Дайлер',
  collection: 'Стягнення',
}

export function isProcessingDepartmentTab(value: string | null): value is ProcessingDepartmentTab {
  return value !== null && (PROCESSING_DEPARTMENT_TABS as readonly string[]).includes(value)
}
