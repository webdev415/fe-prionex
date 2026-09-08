/**
 * Promises Daily Report Feature
 *
 * «Обіцянки до кінця місяця» (client-service, migrated Metabase Card 103): a
 * day × department matrix of the money promised for each calendar day of the
 * window, with per-department and grand totals. Not paginated: the whole
 * matrix arrives in one answer and is rendered in full, the no-department
 * series included.
 */

export { PromisesDailyTab } from './components/PromisesDailyTab'
export { PromisesDailyTable } from './components/PromisesDailyTable'
export {
  usePromisesDailyReport,
  promisesDailyReportKeys,
  type UsePromisesDailyReportParams,
} from './hooks'
export { getPromisesDailyReport } from './api/promisesDailyApi'
export type {
  PromisesDailyReportParams,
  PromisesDailyDepartment,
  PromisesDailyReportResponse,
} from './types'
export { EMPTY, formatMoney } from './utils/format'
export { startOfMonthYMD, endOfMonthYMD } from './utils/monthWindow'
export { sumDepartmentsByDay } from './utils/totals'
