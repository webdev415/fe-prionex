/**
 * Unit Tests for Data Transformers
 *
 * Tests transformation helper functions used across the report feature.
 */

import { describe, it, expect } from 'vitest'
import {
  mapPeriodToBackend,
  trendToChangeType,
  formatDuration,
  parseNumber,
  callsOther,
  transformCommunicationStatistics,
  transformHourlyBreakdown,
  transformOperatorPerformance,
  transformToAgentPerformanceRows,
} from '../transformers'
import type {
  BackendCommunicationStatisticsResponse,
  BackendOperatorPerformance,
  BackendOperatorPerformanceResponse,
} from '../../api/types'
import type { OperatorPerformanceUI } from '../../types'

describe('mapPeriodToBackend', () => {
  it('should map "today" to "today"', () => {
    expect(mapPeriodToBackend('today')).toBe('today')
  })

  it('should map "thisWeek" to "this_week"', () => {
    expect(mapPeriodToBackend('thisWeek')).toBe('this_week')
  })

  it('should map "thisMonth" to "this_month"', () => {
    expect(mapPeriodToBackend('thisMonth')).toBe('this_month')
  })
})

describe('trendToChangeType', () => {
  it('should return "increase" for "up"', () => {
    expect(trendToChangeType('up')).toBe('increase')
  })

  it('should return "decrease" for "down"', () => {
    expect(trendToChangeType('down')).toBe('decrease')
  })

  it('should return "increase" for "stable"', () => {
    // Stable trends are treated as increase (no decrease indicator)
    expect(trendToChangeType('stable')).toBe('increase')
  })
})

describe('formatDuration', () => {
  it('should format 0 seconds as "00:00"', () => {
    expect(formatDuration(0)).toBe('00:00')
  })

  it('should format seconds only as "M:SS"', () => {
    expect(formatDuration(125)).toBe('2:05')
  })

  it('should format minutes and seconds as "M:SS"', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('should format hours, minutes, and seconds as "H:MM:SS"', () => {
    expect(formatDuration(3665)).toBe('1:01:05')
  })

  it('should handle negative numbers as 0', () => {
    expect(formatDuration(-10)).toBe('00:00')
  })

  it('should pad seconds correctly', () => {
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3605)).toBe('1:00:05')
  })

  it('should handle large durations', () => {
    expect(formatDuration(7265)).toBe('2:01:05') // 2 hours, 1 min, 5 sec
  })
})

describe('parseNumber', () => {
  it('should parse string numbers', () => {
    expect(parseNumber('123')).toBe(123)
    expect(parseNumber('123.45')).toBe(123.45)
  })

  it('should return number as-is', () => {
    expect(parseNumber(123)).toBe(123)
    expect(parseNumber(123.45)).toBe(123.45)
  })

  it('should return 0 for empty string', () => {
    expect(parseNumber('')).toBe(0)
  })

  it('should return 0 for invalid string', () => {
    expect(parseNumber('invalid')).toBe(0)
  })

  it('should handle decimal strings', () => {
    expect(parseNumber('0.5')).toBe(0.5)
    expect(parseNumber('999.99')).toBe(999.99)
  })

  it('should handle negative numbers', () => {
    expect(parseNumber(-123)).toBe(-123)
    expect(parseNumber('-456')).toBe(-456)
  })
})

describe('transformHourlyBreakdown (D9 #1333)', () => {
  it('reads the report-service field `calls` (contract C2), not `calls_made`', () => {
    expect(
      transformHourlyBreakdown({ hour: 9, calls: 42, calls_answered: 7, sms_sent: 3 })
    ).toEqual({ label: '09:00-10:00', calls: 42, callsAnswered: 7 })
  })

  it('prefers `calls` when a payload carries both names', () => {
    expect(
      transformHourlyBreakdown({
        hour: 9,
        calls: 42,
        calls_made: 5,
        calls_answered: 7,
        sms_sent: 3,
      }).calls
    ).toBe(42)
  })

  it('still reads the legacy `calls_made` when `calls` is absent', () => {
    const entry = {
      hour: 10,
      calls_made: 17,
      calls_answered: 4,
      sms_sent: 0,
    } as unknown as Parameters<typeof transformHourlyBreakdown>[0]

    expect(transformHourlyBreakdown(entry)).toEqual({
      label: '10:00-11:00',
      calls: 17,
      callsAnswered: 4,
    })
  })

  it('never produces NaN for a payload that lacks the count', () => {
    const entry = { hour: 23 } as unknown as Parameters<typeof transformHourlyBreakdown>[0]

    const result = transformHourlyBreakdown(entry)

    expect(result.calls).toBe(0)
    expect(result.callsAnswered).toBe(0)
    expect(result.label).toBe('23:00-24:00')
  })

  it('keeps every non-empty hour of a real report-service payload', () => {
    // Shape exactly as report-service serialises HourlyBreakdown.
    const payload: BackendCommunicationStatisticsResponse = {
      project_id: 1,
      date_range: { from_date: '2026-09-21', to_date: '2026-09-21' },
      call_statistics: {
        total_calls: 30,
        calls_answered: 6,
        calls_no_answer: 20,
        calls_busy: 2,
        calls_failed: 2,
        contact_rate: 20,
        total_talk_time: 300,
        avg_call_duration: 50,
      },
      sms_statistics: { total_sent: 0, delivered: 0, failed: 0, delivery_rate: 0 },
      hourly_breakdown: [
        { hour: 6, calls: 10, calls_answered: 2, sms_sent: 0 },
        { hour: 7, calls: 20, calls_answered: 4, sms_sent: 0 },
        { hour: 8, calls: 0, calls_answered: 0, sms_sent: 0 },
      ],
      generated_at: '2026-09-21T10:00:00Z',
    }

    const hourly = transformCommunicationStatistics(payload).hourlyBreakdown

    expect(hourly.map((h) => h.calls)).toEqual([10, 20, 0])
    expect(hourly.filter((h) => h.calls > 0)).toHaveLength(2)
  })
})

describe('call outcomes add up to the total — «Інше» (calls_other)', () => {
  const baseStats: BackendCommunicationStatisticsResponse['call_statistics'] = {
    total_calls: 100,
    calls_answered: 20,
    calls_no_answer: 50,
    calls_busy: 5,
    calls_failed: 5,
    contact_rate: 20,
    total_talk_time: 0,
    avg_call_duration: 0,
  }

  function payload(
    callStatistics: BackendCommunicationStatisticsResponse['call_statistics']
  ): BackendCommunicationStatisticsResponse {
    return {
      project_id: 1,
      date_range: { from_date: '2026-09-21', to_date: '2026-09-21' },
      call_statistics: callStatistics,
      sms_statistics: { total_sent: 0, delivered: 0, failed: 0, delivery_rate: 0 },
      generated_at: '2026-09-21T10:00:00Z',
    }
  }

  it('takes report-service `calls_other` when it is sent', () => {
    expect(callsOther({ ...baseStats, calls_other: 7 })).toBe(7)
  })

  it('derives total − (answered + no answer + busy + failed) for an older backend', () => {
    expect(callsOther(baseStats)).toBe(20)
  })

  it('never goes below zero when the buckets exceed the total', () => {
    expect(callsOther({ ...baseStats, total_calls: 70 })).toBe(0)
  })

  it('falls back to the derivation for a non-numeric `calls_other`', () => {
    const stats = { ...baseStats, calls_other: null } as unknown as typeof baseStats
    expect(callsOther(stats)).toBe(20)
  })

  it('carries `other` through transformCommunicationStatistics', () => {
    const withField = transformCommunicationStatistics(payload({ ...baseStats, calls_other: 20 }))
    const derived = transformCommunicationStatistics(payload(baseStats))

    for (const { callStatistics: c } of [withField, derived]) {
      expect(c.other).toBe(20)
      expect(c.answered + c.noAnswer + c.busy + c.failed + c.other).toBe(c.totalCalls)
    }
  })
})

describe('transformToAgentPerformanceRows (D10 #1334)', () => {
  it('carries answered calls and talk time so the totals row can be weighted', () => {
    const operators: OperatorPerformanceUI[] = [
      {
        operatorId: 5,
        operatorName: 'Olena',
        summary: {
          totalCalls: 200,
          callsAnswered: 40,
          contactRate: 20,
          totalTalkTime: 2040,
          totalTalkTimeFormatted: '34:00',
          avgCallDuration: 51,
          avgCallDurationFormatted: '0:51',
          smsSent: 3,
          messagesSent: 1,
          paymentsCollected: 1500,
          paymentsCount: 2,
        },
        dailyBreakdown: [],
      },
    ]

    expect(transformToAgentPerformanceRows(operators)).toEqual([
      {
        id: '5',
        operator: 'Olena',
        calls: 200,
        contactRate: 20,
        avgDuration: '0:51',
        callsAnswered: 40,
        totalTalkTime: 2040,
        sms: 3,
        messages: 1,
        payments: 1500,
      },
    ])
  })
})

describe('operator performance — ranking eligibility and top collector (D8 #1332 AC#2)', () => {
  function backendOperator(
    operatorId: number,
    operatorName: string,
    paymentsCollected: number | string,
    rankingEligible?: boolean | null
  ): BackendOperatorPerformance {
    return {
      operator_id: operatorId,
      operator_name: operatorName,
      summary: {
        total_calls: 0,
        calls_answered: 0,
        contact_rate: 0,
        total_talk_time: 0,
        avg_call_duration: 0,
        sms_sent: 0,
        payments_collected: paymentsCollected,
        payments_count: 1,
      },
      daily_breakdown: [],
      ...(rankingEligible === undefined ? {} : { ranking_eligible: rankingEligible }),
    }
  }

  function response(
    extra: Partial<BackendOperatorPerformanceResponse> = {}
  ): BackendOperatorPerformanceResponse {
    return {
      project_id: 1,
      date_range: { from_date: '2026-09-23', to_date: '2026-09-23' },
      operators: [
        backendOperator(7499, 'Analyst', '180574.52', false),
        backendOperator(1, 'Administrator System', '84947.75', false),
        backendOperator(7234, 'Collector', '22600.00', true),
        backendOperator(9, 'Unresolved', 100, null),
      ],
      generated_at: '2026-09-23T10:00:00Z',
      ...extra,
    }
  }

  it('keeps an absent top_collector (older backend) apart from null', () => {
    // An older report-service sends neither top_collector nor ranking_eligible.
    const olderPayload = response({
      operators: [
        backendOperator(7499, 'Analyst', '180574.52'),
        backendOperator(7234, 'Collector', '22600.00'),
      ],
    })
    const olderBackend = transformOperatorPerformance(olderPayload)

    expect('top_collector' in olderPayload).toBe(false)
    expect(olderBackend.topCollector).toBeUndefined()
    expect(olderBackend.operators.map((op) => op.rankingEligible)).toEqual([undefined, undefined])

    expect(transformOperatorPerformance(response({ top_collector: null })).topCollector).toBeNull()
  })

  it('maps the top collector and parses a string amount', () => {
    const ui = transformOperatorPerformance(
      response({
        top_collector: {
          operator_id: 7234,
          operator_name: 'Collector',
          payments_collected: '22600.50',
          payments_count: 3,
        },
      })
    )

    expect(ui.topCollector).toEqual({
      operatorId: 7234,
      operatorName: 'Collector',
      paymentsCollected: 22_600.5,
      paymentsCount: 3,
    })
  })

  it('carries ranking_eligible through to the operators and the table rows', () => {
    const ui = transformOperatorPerformance(response({ top_collector: null }))

    expect(ui.operators.map((op) => op.rankingEligible)).toEqual([false, false, true, null])
    expect(
      transformToAgentPerformanceRows(ui.operators).map((row) => [
        row.operator,
        row.rankingEligible,
      ])
    ).toEqual([
      ['Analyst', false],
      ['Administrator System', false],
      ['Collector', true],
      ['Unresolved', null],
    ])
  })
})
