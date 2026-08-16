/**
 * Low-Verification Feed Feature
 *
 * «Мало верифікацій 3-х осіб» work list (client-service, migrated Metabase
 * Card 148): freshly purchased clients that still carry few verified
 * third-party contacts, one row per CLIENT — the flip side of the per-operator
 * verification report (Card 128).
 */

export { LowVerificationFeedTab } from './components/LowVerificationFeedTab'
export { LowVerificationTable } from './components/LowVerificationTable'
export {
  useLowVerificationFeed,
  lowVerificationFeedKeys,
  type UseLowVerificationFeedParams,
} from './hooks'
export { getLowVerificationFeed } from './api/lowVerificationFeedApi'
export type {
  LowVerificationFeedParams,
  LowVerificationFeedRow,
  LowVerificationFeedResponse,
} from './types'
export { formatCalendarDay } from './utils/calendarDay'
export { parseMaxVerified, MAX_VERIFIED_CEILING, type MaxVerifiedParse } from './utils/maxVerified'
