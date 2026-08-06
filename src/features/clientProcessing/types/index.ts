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

/**
 * One department sub-tab.
 *
 * `id` is the URL-safe value stored in `?dept=` (stable slug for known
 * departments, the raw backend name otherwise); `departmentName` is the exact
 * `department_name` string rows are filtered by; `labelKey` is set only for
 * known departments (display mapping lives in i18n — e.g. «Стягнення» shows
 * as "Collection" in en), unknown departments display their raw name.
 */
export interface DepartmentTabDef {
  id: string
  departmentName: string
  labelKey?: string
}

/**
 * Known departments in canonical display order (ТП → Дайлер → Стягнення).
 * Sub-tabs are otherwise built dynamically from the response's distinct
 * `department_name` values, so renaming/adding a department on the backend
 * shows up as a tab instead of silently losing rows.
 */
export const KNOWN_DEPARTMENT_TABS: DepartmentTabDef[] = [
  { id: 'tp', departmentName: 'ТП', labelKey: 'pages.reports.processing.departments.tp' },
  {
    id: 'dialer',
    departmentName: 'Дайлер',
    labelKey: 'pages.reports.processing.departments.dialer',
  },
  {
    id: 'collection',
    departmentName: 'Стягнення',
    labelKey: 'pages.reports.processing.departments.collection',
  },
]
