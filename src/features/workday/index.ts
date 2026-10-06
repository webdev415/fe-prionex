/**
 * Workday Report Feature
 *
 * «Робочий день з розривами» / «Робочий місяць з розривами» (client-service,
 * migrated Metabase Cards 73 + 74 and the Techno-Finance «KPI > Факторинг»
 * pages): per operator, when the Kyiv day started and ended, the working time,
 * the breaks longer than the threshold (with the events around each) and the
 * Card 145 call metrics; per month, the totals over the weekdays and the
 * average break per active day. Contract: KAN-KB-31 PR 6.
 */

export { WorkdayTab } from './components/WorkdayTab'
export { WorkmonthTab } from './components/WorkmonthTab'
export {
  useWorkdayReport,
  useWorkdayBreaks,
  useWorkmonthReport,
  useWorkmonthDays,
  workdayReportKeys,
} from './hooks'
export type * from './api/types'
