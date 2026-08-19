/**
 * Operator Promises Report Feature
 *
 * «Обіцянки по операторах» (client-service, migrated Metabase Card 102): one
 * row per OPERATOR — the chain runs they first touched in the period, the money
 * they took promises for, the money that was DUE in the period, the money that
 * arrived, and the conversion between the last two. Not paginated: the whole
 * roster is returned and grouped into department sub-tabs on the frontend.
 */

export { OperatorPromisesTab } from './components/OperatorPromisesTab'
export {
  OperatorPromisesTable,
  OPERATOR_PROMISES_COLUMN_COUNT,
} from './components/OperatorPromisesTable'
export { OperatorPromisesTotals } from './components/OperatorPromisesTotals'
export {
  useOperatorPromisesReport,
  operatorPromisesReportKeys,
  type UseOperatorPromisesReportParams,
} from './hooks'
export { getOperatorPromisesReport } from './api/operatorPromisesApi'
export type {
  OperatorPromisesReportParams,
  OperatorPromisesRow,
  OperatorPromisesTotals as OperatorPromisesTotalsData,
  OperatorPromisesReportResponse,
} from './types'
export {
  OPERATOR_PROMISES_TAB_IDS,
  DEFAULT_OPERATOR_PROMISES_TAB,
  resolveOperatorPromisesTab,
  filterRowsByTab,
  type OperatorPromisesTabId,
} from './utils/departmentTabs'
export { sumOperatorPromisesRows } from './utils/totals'
export { formatConversion, formatCount, formatMoney } from './utils/format'
