/**
 * Client Processing Feature
 *
 * "Відпрацювання за ЦД" report (client-service, migrated Metabase Card 162):
 * per-employee assigned vs processed clients within a date window.
 */

export { ClientProcessingTab } from './components/ClientProcessingTab'
export { ProcessingTable } from './components/ProcessingTable'
export {
  useClientProcessingReport,
  clientProcessingKeys,
  type UseClientProcessingReportParams,
} from './hooks'
export { getClientProcessingReport } from './api/clientProcessingApi'
export { KNOWN_DEPARTMENTS } from './types'
export type {
  DepartmentTabDef,
  KnownDepartment,
  ProcessingReportParams,
  ProcessingReportRow,
  ProcessingReportResponse,
} from './types'
export {
  buildDepartmentTabs,
  resolveActiveDepartmentTab,
  rowDepartmentTabId,
  NO_DEPARTMENT_TAB_ID,
} from './utils/departmentTabs'
export { formatPercent, gradientRedToGreen, percentCellBackground } from './utils/percentGradient'
