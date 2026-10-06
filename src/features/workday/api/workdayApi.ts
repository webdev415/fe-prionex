/**
 * Workday Report API
 *
 * The four client-service endpoints behind the «Робочий день з розривами» and
 * «Робочий місяць з розривами» tabs. Uses the main api client (Kong).
 *
 * Every request opts OUT of the client's transient-retry (`_noTransientRetry`).
 * That retry re-sends a GET 503 after 0.5 s and 1 s, which is right for a
 * gateway hiccup and wrong for this backend: each of its 503s is a deliberate
 * coded refusal carrying `Retry-After` of 20–900 s — a live build that already
 * waited its slot (`WORKDAY_LIVE_BUSY`), blew its deadline
 * (`WORKDAY_LIVE_DEADLINE`), a source that is down, or a month whose stale days
 * only the nightly job can heal (`WORKDAY_MONTH_NOT_READY`, which the contract
 * says the frontend must NOT retry by itself). Two immediate repeats would
 * only triple the wait behind the slot and the load on it. The tab shows the
 * server's retry hint and a manual retry button instead.
 */

import api from '@/lib/api'
import type {
  WorkdayBreaksParams,
  WorkdayBreaksResponse,
  WorkdayReportParams,
  WorkdayReportResponse,
  WorkmonthDaysParams,
  WorkmonthDaysResponse,
  WorkmonthReportParams,
  WorkmonthReportResponse,
} from './types'

const REPORTS_URL = '/api/v1/clients/reports'

/** See the module docstring for why these requests are never auto-retried. */
const NO_TRANSIENT_RETRY = { _noTransientRetry: true }

function requestConfig(params: object): Parameters<typeof api.get>[1] {
  return { params, ...NO_TRANSIENT_RETRY } as Parameters<typeof api.get>[1]
}

/** «Робочий день з розривами»: one row per operator who was active that Kyiv day. */
export async function getWorkdayReport(
  params: WorkdayReportParams
): Promise<WorkdayReportResponse> {
  const response = await api.get<WorkdayReportResponse>(
    `${REPORTS_URL}/workday`,
    requestConfig(params)
  )
  return response.data
}

/** The day modal: one operator's breaks of that day with the events around them. */
export async function getWorkdayBreaks(
  userId: number,
  params: WorkdayBreaksParams
): Promise<WorkdayBreaksResponse> {
  const response = await api.get<WorkdayBreaksResponse>(
    `${REPORTS_URL}/workday/${encodeURIComponent(String(userId))}/breaks`,
    requestConfig(params)
  )
  return response.data
}

/** «Робочий місяць з розривами»: one row per operator active in the month's window. */
export async function getWorkmonthReport(
  params: WorkmonthReportParams
): Promise<WorkmonthReportResponse> {
  const response = await api.get<WorkmonthReportResponse>(
    `${REPORTS_URL}/workmonth`,
    requestConfig(params)
  )
  return response.data
}

/** The month modal: every calendar day of the month for one operator. */
export async function getWorkmonthDays(
  userId: number,
  params: WorkmonthDaysParams
): Promise<WorkmonthDaysResponse> {
  const response = await api.get<WorkmonthDaysResponse>(
    `${REPORTS_URL}/workmonth/${encodeURIComponent(String(userId))}/days`,
    requestConfig(params)
  )
  return response.data
}
