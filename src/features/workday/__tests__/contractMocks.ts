/**
 * The PR 6 contract mocks (docs: card-73-74-contract/*.json), vendored
 * verbatim into `./contract/` — the same fictional operators 90001–90004 and
 * fictional `3800000000xx` numbers in every file. Error mocks are
 * `{status, headers, body}`; `httpError` turns one into the shape axios
 * rejects with, so `lib/errors` and `lib/api` predicates read it for real.
 */

import type {
  WorkdayBreaksResponse,
  WorkdayReportResponse,
  WorkmonthDaysResponse,
  WorkmonthReportResponse,
} from '../api/types'
import error400BeforeHistory from './contract/error-400-before-history.json'
import error400DayInFuture from './contract/error-400-day-in-future.json'
import error400UnknownTimezone from './contract/error-400-unknown-timezone.json'
import error404FlagOff from './contract/error-404-flag-off.json'
import error404OperatorNotFound from './contract/error-404-operator-not-found.json'
import error503LiveBusy from './contract/error-503-live-busy.json'
import error503LiveDeadline from './contract/error-503-live-deadline.json'
import error503MonthNotReady from './contract/error-503-month-not-ready.json'
import error503SourceUnavailable from './contract/error-503-source-unavailable.json'
import workdayBreaksJson from './contract/workday-breaks.json'
import workdayTodayJson from './contract/workday-today-live-calls-unavailable.json'
import workdayJson from './contract/workday.json'
import workmonthDaysJson from './contract/workmonth-days.json'
import workmonthFutureJson from './contract/workmonth-future-empty.json'
import workmonthJson from './contract/workmonth.json'

/** A fresh deep copy per call — a test may mutate what it gets. */
const clone = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T

export const mockWorkday = () => clone<WorkdayReportResponse>(workdayJson)
export const mockWorkdayTodayCallsUnavailable = () => clone<WorkdayReportResponse>(workdayTodayJson)
export const mockWorkdayBreaks = () => clone<WorkdayBreaksResponse>(workdayBreaksJson)
export const mockWorkmonth = () => clone<WorkmonthReportResponse>(workmonthJson)
export const mockWorkmonthFutureEmpty = () => clone<WorkmonthReportResponse>(workmonthFutureJson)
export const mockWorkmonthDays = () => clone<WorkmonthDaysResponse>(workmonthDaysJson)

interface ErrorMock {
  status: number
  headers: Record<string, string>
  body: unknown
}

export const ERROR_MOCKS = {
  beforeHistory: error400BeforeHistory,
  dayInFuture: error400DayInFuture,
  unknownTimezone: error400UnknownTimezone,
  flagOff: error404FlagOff,
  operatorNotFound: error404OperatorNotFound,
  liveBusy: error503LiveBusy,
  liveDeadline: error503LiveDeadline,
  monthNotReady: error503MonthNotReady,
  sourceUnavailable: error503SourceUnavailable,
} satisfies Record<string, ErrorMock>

/** An AxiosError-shaped rejection built from one of the contract's error mocks. */
export function httpError(mock: ErrorMock, { withHeaders = true } = {}) {
  const headers = withHeaders
    ? Object.fromEntries(Object.entries(mock.headers).map(([k, v]) => [k.toLowerCase(), v]))
    : {}
  return Object.assign(new Error(`HTTP ${mock.status}`), {
    isAxiosError: true,
    response: { status: mock.status, data: clone(mock.body), headers },
  })
}
