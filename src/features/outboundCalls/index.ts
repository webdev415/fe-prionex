/**
 * Outbound Calls Report Feature
 *
 * «Вихідні дзвінки» (client-service, migrated Metabase Card 145): one row per
 * OPERATOR SEAT — calls dialled in the period, how many reached a person, how
 * many of those lasted long enough to count, the talk time behind them and the
 * seat's org placement. Not paginated: the whole roster of seats that dialled
 * in the window is returned and rendered in the server's order.
 */

export { OutboundCallsTab } from './components/OutboundCallsTab'
export { OutboundCallsTable, OUTBOUND_CALLS_COLUMN_COUNT } from './components/OutboundCallsTable'
export {
  useOutboundCallsReport,
  outboundCallsReportKeys,
  type UseOutboundCallsReportParams,
} from './hooks'
export { getOutboundCallsReport } from './api/outboundCallsApi'
export type {
  OutboundCallsReportParams,
  OutboundCallsReportRow,
  OutboundCallsReportResponse,
} from './types'
export { EMPTY, formatCount, formatDurationHms, formatPercent, operatorLabel } from './utils/format'
