/**
 * Recorded Payments Feed Feature
 *
 * «Внесені платежі» (payment-service, migrated Metabase Card 76): the list of
 * payments whose BANK confirmation date falls inside the window — one row per
 * PAYMENT — with the whole-selection summary and a per-operator breakdown on
 * the client's RESPONSIBLE employee (key B, matched by id, as the source
 * system's popup filters). Paginated DB-side; the default window is the
 * current month to date in the profile zone; «Тільки підтверджені» is a
 * server-side switch, off by default (all statuses, as the source system).
 */

export { RecordedPaymentsTab } from './components/RecordedPaymentsTab'
export {
  RecordedPaymentsTable,
  RECORDED_PAYMENTS_COLUMN_COUNT,
} from './components/RecordedPaymentsTable'
export { OperatorBreakdown } from './components/OperatorBreakdown'
export {
  useRecordedPaymentsFeed,
  recordedPaymentsFeedKeys,
  type UseRecordedPaymentsFeedParams,
} from './hooks'
export {
  getRecordedPaymentsFeed,
  buildRecordedPaymentsFeedQuery,
} from './api/recordedPaymentsFeedApi'
export {
  currentMonthToDateWindow,
  type RecordedPaymentsDefaultWindow,
} from './lib/currentMonthWindow'
export { foldPaymentResponsible, type PaymentResponsible } from './lib/paymentResponsible'
export {
  readOperatorIdsParam,
  formatOperatorIdsParam,
  MAX_OPERATOR_IDS,
  MAX_OPERATOR_ID,
  type OperatorIdsReading,
} from './lib/operatorIdsParam'
export {
  operatorPromisesLink,
  OPERATOR_PROMISES_TAB,
  REPORTS_PATH,
  type OperatorPromisesLinkInput,
} from './lib/operatorPromisesLink'
export type {
  RecordedPaymentsFeedParams,
  RecordedPaymentRow,
  RecordedPaymentsSummary,
  OperatorBreakdownLine,
  RecordedPaymentsFeedResponse,
} from './types'
