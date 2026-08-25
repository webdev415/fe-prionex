/**
 * Inbound Follow-up Feed Feature
 *
 * «Вхід без відпрацювання» work list (client-service, migrated Metabase
 * Card 122): clients whose latest recorded interaction is a tech-support step
 * parked on «Очікує на зворотній зв'язок» and whom nobody has worked since,
 * one row per CLIENT — the operator's to-do list of un-answered inbound
 * requests.
 */

export { InboundFollowupFeedTab } from './components/InboundFollowupFeedTab'
export {
  InboundFollowupTable,
  INBOUND_FOLLOWUP_COLUMN_COUNT,
} from './components/InboundFollowupTable'
export {
  useInboundFollowupFeed,
  inboundFollowupFeedKeys,
  type UseInboundFollowupFeedParams,
} from './hooks'
export { getInboundFollowupFeed } from './api/inboundFollowupFeedApi'
export type {
  InboundFollowupFeedParams,
  InboundFollowupRow,
  InboundFollowupResponse,
} from './types'
