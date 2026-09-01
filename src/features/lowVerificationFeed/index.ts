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
// `formatCalendarDay` used to live here; it moved to `@/lib/calendarDay` when
// the communication-gap feed needed the identical day rendering (same move as
// `isRealCalendarDate` before it) — import it from the lib, not from a feature.
export { parseMaxVerified, MAX_VERIFIED_CEILING, type MaxVerifiedParse } from './utils/maxVerified'
