/**
 * Dashboard metric helpers (reports dashboard, «Звіти» → «Дашборд»).
 *
 * Pure functions, no React: every number the dashboard derives on the client
 * from the per-operator rows goes through here, so the rule for each one lives
 * in exactly one place and is unit-tested (__tests__/dashboardMetrics.test.ts).
 *
 * Why these exist (E10.4 dashboard audit, board #1326/#1332/#1334/#1327):
 * - a percentage over a set of operators is Σanswered / Σcalls, never the plain
 *   mean of the row percentages (a row with 0 calls would pull it towards 0 %);
 * - an average duration over operators is Σtalk time / Σanswered, never the mean
 *   of the row averages;
 * - «best / needs improvement» must not crown or shame an operator on 0 calls;
 * - «top collector» name and amount must come from the SAME operator.
 */

import { formatDuration } from './transformers'
import type { AgentPerformanceRow, OperatorPerformanceUI } from '../types'

// ============================================================================
// Contact-rate ranking (best performer / needs improvement)
// ============================================================================

/**
 * Minimum number of calls an operator needs in the window to be ranked by
 * contact rate. Below it the rate is noise (1 answered out of 2 = 50 %), and
 * an operator with no calls at all has no rate to compare.
 */
export const MIN_CALLS_FOR_RANKING = 20

export interface RankedPerformer {
  name: string
  rate: number
}

export interface ContactRatePerformers {
  bestPerformer: RankedPerformer | null
  needsImprovement: RankedPerformer | null
}

/**
 * Pick the best and the worst operator by contact rate among the operators
 * who made at least `minCalls` calls (and never one with 0 calls).
 *
 * Nobody qualifies → both are null (the modal says there are not enough calls
 * to compare operators instead of ranking anyone). Exactly one
 * qualifies → only `bestPerformer` is set: one operator cannot be both.
 */
export function pickContactRatePerformers(
  operators: OperatorPerformanceUI[],
  minCalls: number = MIN_CALLS_FOR_RANKING
): ContactRatePerformers {
  const threshold = Math.max(1, minCalls)
  const eligible = operators.filter((op) => (op.summary.totalCalls || 0) >= threshold)

  if (eligible.length === 0) {
    return { bestPerformer: null, needsImprovement: null }
  }

  const sortedByRate = [...eligible].sort(
    (a, b) => (b.summary.contactRate || 0) - (a.summary.contactRate || 0)
  )
  const best = sortedByRate[0]
  const worst = sortedByRate[sortedByRate.length - 1]

  return {
    bestPerformer: { name: best.operatorName, rate: Math.round(best.summary.contactRate || 0) },
    needsImprovement:
      worst.operatorId !== best.operatorId
        ? { name: worst.operatorName, rate: Math.round(worst.summary.contactRate || 0) }
        : null,
  }
}

// ============================================================================
// Top collector (payments modal)
// ============================================================================

export interface TopCollector {
  name: string
  amount: number
}

/**
 * The operator with the largest collected amount, name AND amount taken from
 * that one row. No row with a positive amount → null (the modal hides it).
 * Ties keep the first row in the given order.
 */
export function pickTopCollector(
  rows: ReadonlyArray<Pick<AgentPerformanceRow, 'operator' | 'payments'>>
): TopCollector | null {
  let top: TopCollector | null = null
  for (const row of rows) {
    const amount = Number(row.payments) || 0
    if (amount > 0 && (top === null || amount > top.amount)) {
      top = { name: row.operator, amount }
    }
  }
  return top
}

// ============================================================================
// Agent performance table totals
// ============================================================================

/** The row fields the totals row is computed from. */
export type AgentTotalsInputRow = Pick<
  AgentPerformanceRow,
  | 'calls'
  | 'contactRate'
  | 'avgDuration'
  | 'callsAnswered'
  | 'totalTalkTime'
  | 'sms'
  | 'messages'
  | 'payments'
>

export interface AgentPerformanceTotals {
  calls: number
  callsAnswered: number
  /** Σanswered / Σcalls × 100, one decimal. */
  contactRate: number
  /** Σtalk time (seconds). */
  totalTalkTime: number
  /** Σtalk time / Σanswered, formatted like the rows (formatDuration). */
  avgDuration: string
  sms: number
  messages: number
  payments: number
}

/**
 * Parse a duration string produced by `formatDuration` back to seconds:
 * "M:SS", "MM:SS" or "H:MM:SS". Anything unparsable → 0.
 */
export function parseDurationToSeconds(value: string | null | undefined): number {
  if (!value) return 0
  const parts = value.split(':').map((part) => Number(part))
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return 0
  }
  return parts.reduce((total, part) => total * 60 + part, 0)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Weighted totals for the operator table.
 *
 * Answered calls and talk time are taken from the row when the API provided
 * them (`callsAnswered`, `totalTalkTime`); otherwise they are derived:
 * answered = round(calls × rate / 100), talk time = avg duration × answered
 * (report-service defines avg_call_duration as talk time / answered calls).
 */
export function computeAgentPerformanceTotals(
  rows: ReadonlyArray<AgentTotalsInputRow>
): AgentPerformanceTotals {
  let calls = 0
  let callsAnswered = 0
  let totalTalkTime = 0
  let sms = 0
  let messages = 0
  let payments = 0

  for (const row of rows) {
    const rowCalls = row.calls || 0
    const rowAnswered = isCount(row.callsAnswered)
      ? row.callsAnswered
      : Math.round((rowCalls * (row.contactRate || 0)) / 100)
    const rowTalkTime = isCount(row.totalTalkTime)
      ? row.totalTalkTime
      : parseDurationToSeconds(row.avgDuration) * rowAnswered

    calls += rowCalls
    callsAnswered += rowAnswered
    totalTalkTime += rowTalkTime
    sms += row.sms || 0
    messages += row.messages || 0
    payments += row.payments || 0
  }

  const contactRate = calls > 0 ? Math.round((callsAnswered / calls) * 1000) / 10 : 0
  const avgSeconds = callsAnswered > 0 ? Math.round(totalTalkTime / callsAnswered) : 0

  return {
    calls,
    callsAnswered,
    contactRate,
    totalTalkTime,
    avgDuration: formatDuration(avgSeconds),
    sms,
    messages,
    payments,
  }
}
