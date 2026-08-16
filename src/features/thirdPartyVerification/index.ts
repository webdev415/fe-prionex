/**
 * Third-Party Verification Feature
 *
 * "Верифікація 3-х осіб" report (client-service, migrated Metabase Card 128):
 * per-ТП-operator verified third-party contacts on the freshly purchased
 * portfolio, against the operator's monthly plan.
 */

export { ThirdPartyVerificationTab } from './components/ThirdPartyVerificationTab'
export { VerificationTable } from './components/VerificationTable'
export {
  useThirdPartyVerificationReport,
  thirdPartyVerificationKeys,
  type UseThirdPartyVerificationReportParams,
} from './hooks'
export { getThirdPartyVerificationReport } from './api/thirdPartyVerificationApi'
export type {
  ThirdPartyVerificationParams,
  ThirdPartyVerificationRow,
  ThirdPartyVerificationResponse,
} from './types'
export { currentMonthRange, type MonthRange } from './utils/monthRange'
export {
  planDiffTone,
  toFiniteNumber,
  verificationCellBackground,
  verificationGradientBounds,
  type GradientBounds,
  type PlanDiffTone,
} from './utils/verificationGradient'
