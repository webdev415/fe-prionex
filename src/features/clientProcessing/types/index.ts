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
 * One department sub-tab. `id` is the URL-safe value stored in `?dept=`
 * (a stable slug for known departments, the numeric `department_id` for
 * others, `none` for rows without a department). Exactly one of
 * `labelKey` (i18n, known departments) / `label` (raw name) is set.
 */
export interface DepartmentTabDef {
  id: string
  label?: string
  labelKey?: string
}

/** A department with a canonical slug/label ("Стягнення" shows as "Collection" in en). */
export interface KnownDepartment {
  slug: string
  name: string
  labelKey: string
}

/**
 * Known departments in canonical display order (ТП → Дайлер → Стягнення).
 * This is only a display overlay (slug + i18n label) matched by name —
 * sub-tabs themselves are keyed by `department_id` and built dynamically
 * from the response, so renaming/adding a department on the backend shows
 * up as its own tab instead of silently losing rows.
 */
export const KNOWN_DEPARTMENTS: KnownDepartment[] = [
  { slug: 'tp', name: 'ТП', labelKey: 'pages.reports.processing.departments.tp' },
  { slug: 'dialer', name: 'Дайлер', labelKey: 'pages.reports.processing.departments.dialer' },
  {
    slug: 'collection',
    name: 'Стягнення',
    labelKey: 'pages.reports.processing.departments.collection',
  },
]
