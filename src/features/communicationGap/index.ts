/**
 * Communication-Gap Feed Feature
 *
 * «Великий розрив» work list (client-service, migrated Metabase Card 125):
 * clients in work with an active debt whom nobody has reached lately — no fresh
 * interaction, no payment in 30 days, no live promise to pay — one row per
 * CLIENT, sorted so each responsible employee's longest silences come first.
 */

export { CommunicationGapFeedTab } from './components/CommunicationGapFeedTab'
export {
  CommunicationGapTable,
  COMMUNICATION_GAP_COLUMN_COUNT,
} from './components/CommunicationGapTable'
export {
  useCommunicationGapFeed,
  communicationGapFeedKeys,
  type UseCommunicationGapFeedParams,
} from './hooks'
export { getCommunicationGapFeed } from './api/communicationGapFeedApi'
export type {
  CommunicationGapFeedParams,
  CommunicationGapFeedRow,
  CommunicationGapFeedResponse,
} from './types'
export { parseGapMin, GAP_MIN_CEILING, type GapMinParse } from './utils/gapMin'
