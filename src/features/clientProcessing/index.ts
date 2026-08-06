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
export { KNOWN_DEPARTMENT_TABS } from './types'
export type {
  DepartmentTabDef,
  ProcessingReportParams,
  ProcessingReportRow,
  ProcessingReportResponse,
} from './types'
export { buildDepartmentTabs, resolveActiveDepartmentTab } from './utils/departmentTabs'
export { formatPercent, gradientRedToGreen, percentCellBackground } from './utils/percentGradient'
