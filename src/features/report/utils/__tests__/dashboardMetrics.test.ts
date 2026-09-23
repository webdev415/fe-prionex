/**
 * Dashboard metric helpers — board #1326 (D3), #1332 (D8, AC#2), #1334 (D10).
 */

import { describe, it, expect } from 'vitest'
import {
  MIN_CALLS_FOR_RANKING,
  computeAgentPerformanceTotals,
  parseDurationToSeconds,
  pickContactRatePerformers,
  pickTopCollector,
  resolveTopCollector,
  type AgentTotalsInputRow,
} from '../dashboardMetrics'
import type { OperatorPerformanceUI, TopCollectorUI } from '../../types'

function operator(
  operatorId: number,
  operatorName: string,
  totalCalls: number,
  contactRate: number
): OperatorPerformanceUI {
  return {
    operatorId,
    operatorName,
    summary: {
      totalCalls,
      callsAnswered: Math.round((totalCalls * contactRate) / 100),
      contactRate,
      totalTalkTime: 0,
      totalTalkTimeFormatted: '00:00',
      avgCallDuration: 0,
      avgCallDurationFormatted: '00:00',
      smsSent: 0,
      messagesSent: 0,
      paymentsCollected: 0,
      paymentsCount: 0,
    },
    dailyBreakdown: [],
  }
}

describe('pickContactRatePerformers (D3 #1326)', () => {
  it('uses a ranking threshold of 20 calls by default', () => {
    expect(MIN_CALLS_FOR_RANKING).toBe(20)
  })

  it('never names an operator with 0 calls as «needs improvement»', () => {
    // The production symptom: admin / analyst rows with 0 calls sorted last
    // and were shown as «Потрібне покращення (0 %)».
    const result = pickContactRatePerformers([
      operator(1, 'Admin', 0, 0),
      operator(2, 'Olena', 120, 31.5),
      operator(3, 'Petro', 80, 18.2),
      operator(4, 'Analyst', 0, 0),
    ])

    expect(result.bestPerformer).toEqual({ name: 'Olena', rate: 32 })
    expect(result.needsImprovement).toEqual({ name: 'Petro', rate: 18 })
  })

  it('ignores operators below the minimum number of calls', () => {
    const result = pickContactRatePerformers([
      operator(1, 'Two calls, one answered', 2, 50),
      operator(2, 'Olena', 40, 30),
      operator(3, 'Petro', 25, 12),
      operator(4, 'Nineteen calls', MIN_CALLS_FOR_RANKING - 1, 5),
    ])

    expect(result.bestPerformer?.name).toBe('Olena')
    expect(result.needsImprovement?.name).toBe('Petro')
  })

  it('counts an operator with exactly the minimum number of calls', () => {
    const result = pickContactRatePerformers([
      operator(1, 'Olena', 100, 30),
      operator(2, 'At the threshold', MIN_CALLS_FOR_RANKING, 5),
    ])

    expect(result.needsImprovement?.name).toBe('At the threshold')
  })

  it('shows neither when nobody qualifies', () => {
    expect(pickContactRatePerformers([operator(1, 'A', 0, 0), operator(2, 'B', 5, 60)])).toEqual({
      bestPerformer: null,
      needsImprovement: null,
    })
    expect(pickContactRatePerformers([])).toEqual({ bestPerformer: null, needsImprovement: null })
  })

  it('shows only the best performer when a single operator qualifies', () => {
    const result = pickContactRatePerformers([operator(1, 'Solo', 50, 40), operator(2, 'Z', 3, 0)])

    expect(result.bestPerformer).toEqual({ name: 'Solo', rate: 40 })
    expect(result.needsImprovement).toBeNull()
  })

  it('accepts a custom threshold, but never ranks a 0-call row even at threshold 0', () => {
    const result = pickContactRatePerformers(
      [operator(1, 'A', 3, 66.7), operator(2, 'B', 2, 0), operator(3, 'Zero', 0, 0)],
      0
    )

    expect(result.bestPerformer?.name).toBe('A')
    expect(result.needsImprovement?.name).toBe('B')
  })
})

describe('pickTopCollector (D8 #1332)', () => {
  it('takes name and amount from the same row — the one with the largest payments', () => {
    // Row order is the table order (not sorted by payments): the old code took
    // the name from one source and `rows[0].payments` from another.
    const top = pickTopCollector([
      { operator: 'Most calls', payments: 1200 },
      { operator: 'Top collector', payments: 58_000.5 },
      { operator: 'Other', payments: 9_000 },
    ])

    expect(top).toEqual({ name: 'Top collector', amount: 58_000.5 })
  })

  it('returns null when nobody collected anything', () => {
    expect(pickTopCollector([{ operator: 'A', payments: 0 }])).toBeNull()
    expect(pickTopCollector([])).toBeNull()
  })

  it('keeps the first row on a tie', () => {
    expect(
      pickTopCollector([
        { operator: 'First', payments: 500 },
        { operator: 'Second', payments: 500 },
      ])
    ).toEqual({ name: 'First', amount: 500 })
  })

  it('never crowns a row report-service ruled out, however large (AC#2)', () => {
    // The production symptom of 23.09: an analyst and «Administrator System»
    // held the largest attributed sums and were shown as the best collector.
    const top = pickTopCollector([
      { operator: 'Analyst', payments: 180_574.52, rankingEligible: false },
      { operator: 'Administrator System', payments: 84_947.75, rankingEligible: false },
      { operator: 'Collector', payments: 22_600, rankingEligible: true },
    ])

    expect(top).toEqual({ name: 'Collector', amount: 22_600 })
  })

  it('still ranks rows without the mark (older backend or unresolved)', () => {
    expect(
      pickTopCollector([
        { operator: 'Older backend', payments: 500 },
        { operator: 'Unresolved', payments: 700, rankingEligible: null },
      ])
    ).toEqual({ name: 'Unresolved', amount: 700 })
  })

  it('returns null when only ruled-out rows collected anything', () => {
    expect(
      pickTopCollector([
        { operator: 'Administrator System', payments: 84_947.75, rankingEligible: false },
        { operator: 'Collector', payments: 0, rankingEligible: true },
      ])
    ).toBeNull()
  })
})

describe('resolveTopCollector (D8 #1332 AC#2)', () => {
  const rows = [
    { operator: 'Administrator System', payments: 180_574.52, rankingEligible: false },
    { operator: 'Collector', payments: 22_600, rankingEligible: true },
    { operator: 'Other', payments: 9_000, rankingEligible: true },
  ]
  const server: TopCollectorUI = {
    operatorId: 7234,
    operatorName: 'Server pick',
    paymentsCollected: 22_600,
    paymentsCount: 3,
  }

  it("shows report-service's top collector as is when it sends one", () => {
    expect(resolveTopCollector(server, rows)).toEqual({ name: 'Server pick', amount: 22_600 })
  })

  it('hides the tile when report-service says nobody may be crowned (null)', () => {
    // No local fallback: the rows still have a positive eligible amount.
    expect(resolveTopCollector(null, rows)).toBeNull()
  })

  it('falls back to the local pick over the eligible rows on an older backend (undefined)', () => {
    expect(resolveTopCollector(undefined, rows)).toEqual({ name: 'Collector', amount: 22_600 })
    expect(resolveTopCollector(undefined, [])).toBeNull()
  })
})

describe('parseDurationToSeconds', () => {
  it.each([
    ['0:27', 27],
    ['00:00', 0],
    ['2:05', 125],
    ['1:01:05', 3665],
  ])('parses %s', (value, expected) => {
    expect(parseDurationToSeconds(value)).toBe(expected)
  })

  it.each([[''], ['abc'], ['1'], [null], [undefined]])('returns 0 for %s', (value) => {
    expect(parseDurationToSeconds(value)).toBe(0)
  })
})

function row(overrides: Partial<AgentTotalsInputRow>): AgentTotalsInputRow {
  return {
    calls: 0,
    contactRate: 0,
    avgDuration: '00:00',
    sms: 0,
    messages: 0,
    payments: 0,
    ...overrides,
  }
}

describe('computeAgentPerformanceTotals (D10 #1334)', () => {
  it('weights the contact rate by calls instead of averaging row percentages', () => {
    const totals = computeAgentPerformanceTotals([
      row({ calls: 100, callsAnswered: 20, contactRate: 20, totalTalkTime: 1000 }),
      row({ calls: 0, callsAnswered: 0, contactRate: 0, totalTalkTime: 0 }),
      row({ calls: 0, callsAnswered: 0, contactRate: 0, totalTalkTime: 0 }),
    ])

    // Plain mean of 20 %, 0 %, 0 % would be 7 %; the real rate is 20 / 100.
    expect(totals.calls).toBe(100)
    expect(totals.callsAnswered).toBe(20)
    expect(totals.contactRate).toBe(20)
  })

  it('weights the average duration by answered calls instead of averaging averages', () => {
    const totals = computeAgentPerformanceTotals([
      // 10 answered, 100 s each
      row({ calls: 50, callsAnswered: 10, contactRate: 20, totalTalkTime: 1000 }),
      // 90 answered, 20 s each
      row({ calls: 150, callsAnswered: 90, contactRate: 60, totalTalkTime: 1800 }),
    ])

    // Mean of averages = (100 + 20) / 2 = 60 s; weighted = 2800 / 100 = 28 s.
    expect(totals.totalTalkTime).toBe(2800)
    expect(totals.avgDuration).toBe('0:28')
    expect(totals.contactRate).toBe(50)
  })

  it('reproduces the production figures (21.09: 1 641 answered of 8 365, 83 371 s)', () => {
    const totals = computeAgentPerformanceTotals([
      row({ calls: 5000, callsAnswered: 1000, totalTalkTime: 50_000, contactRate: 20 }),
      row({ calls: 3365, callsAnswered: 641, totalTalkTime: 33_371, contactRate: 19 }),
    ])

    expect(totals.contactRate).toBe(19.6)
    expect(totals.avgDuration).toBe('0:51')
  })

  it('derives answered and talk time from rate and avg duration when the API omits them', () => {
    const totals = computeAgentPerformanceTotals([
      row({ calls: 200, contactRate: 25, avgDuration: '1:00' }), // 50 answered, 3000 s
      row({ calls: 100, contactRate: 50, avgDuration: '0:30' }), // 50 answered, 1500 s
      row({ calls: 0, contactRate: 0, avgDuration: '00:00' }),
    ])

    expect(totals.callsAnswered).toBe(100)
    expect(totals.contactRate).toBe(33.3)
    expect(totals.totalTalkTime).toBe(4500)
    expect(totals.avgDuration).toBe('0:45')
  })

  it('sums the additive columns', () => {
    const totals = computeAgentPerformanceTotals([
      row({ calls: 1, sms: 2, messages: 3, payments: 100.5 }),
      row({ calls: 4, sms: 5, messages: 6, payments: 200 }),
    ])

    expect(totals).toMatchObject({ calls: 5, sms: 7, messages: 9, payments: 300.5 })
  })

  it('returns zeros for no rows or no calls', () => {
    expect(computeAgentPerformanceTotals([])).toEqual({
      calls: 0,
      callsAnswered: 0,
      contactRate: 0,
      totalTalkTime: 0,
      avgDuration: '00:00',
      sms: 0,
      messages: 0,
      payments: 0,
    })
    expect(computeAgentPerformanceTotals([row({})]).contactRate).toBe(0)
  })
})
