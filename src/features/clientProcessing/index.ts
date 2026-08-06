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
export {
  PROCESSING_DEPARTMENT_TABS,
  PROCESSING_TAB_TO_DEPARTMENT,
  isProcessingDepartmentTab,
} from './types'
export type {
  ProcessingDepartmentTab,
  ProcessingReportParams,
  ProcessingReportRow,
  ProcessingReportResponse,
} from './types'
export { formatPercent, gradientRedToGreen, percentCellBackground } from './utils/percentGradient'
