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
  transformCommunicationStatistics,
  transformHourlyBreakdown,
  transformToAgentPerformanceRows,
} from '../transformers'
import type { BackendCommunicationStatisticsResponse } from '../../api/types'
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
