/**
 * Deadlines shown in the thread drawer and the parameters panel have to match
 * the kanban card beside them (KAN-1000).
 *
 * `formatDueDate` read both deadline shapes through a bare `new Date`: naive
 * UTC came out on the browser clock, and date-only came out as UTC midnight
 * rendered locally, which fabricates a time and loses a day west of UTC.
 */

import { describe, it, expect } from 'vitest'
import { formatLegalDeadline } from '../formatters'
import { formatLegalDueDateTime } from '@/features/lawyerWorkplace/utils/legalDueDate'

const KYIV = 'Europe/Kyiv'

describe('formatLegalDeadline', () => {
  it('reads a naive kanban due date on the profile clock', () => {
    expect(formatLegalDeadline('2026-08-14T03:00:00', 'uk', KYIV)).toBe('14.08.2026, 06:00')
  })

  it('agrees with the time the kanban card shows', () => {
    const stored = '2026-08-14T03:00:00'
    const onCard = formatLegalDueDateTime(stored, KYIV, 'uk')
    expect(formatLegalDeadline(stored, 'uk', KYIV)).toContain(onCard.split(' ')[1])
  })

  it('leaves a value that already carries an offset alone', () => {
    expect(formatLegalDeadline('2026-08-14T03:00:00Z', 'uk', KYIV)).toBe('14.08.2026, 06:00')
  })

  it('renders an SLA date-only value as a date, with no invented time', () => {
    expect(formatLegalDeadline('2026-08-14', 'uk', KYIV)).toBe('14.08.2026')
  })

  it('keeps a date-only value on its own day in every timezone', () => {
    for (const tz of [KYIV, 'America/New_York', 'Asia/Singapore', 'UTC']) {
      expect(formatLegalDeadline('2026-08-14', 'uk', tz)).toBe('14.08.2026')
    }
  })

  it('follows the profile timezone rather than a fixed offset', () => {
    expect(formatLegalDeadline('2026-08-14T03:00:00', 'uk', 'America/New_York')).toBe(
      '13.08.2026, 23:00'
    )
    expect(formatLegalDeadline('2026-08-14T03:00:00', 'uk', 'UTC')).toBe('14.08.2026, 03:00')
  })

  it('falls back to Kyiv when no profile timezone is passed', () => {
    expect(formatLegalDeadline('2026-08-14T03:00:00', 'uk')).toBe('14.08.2026, 06:00')
  })

  it('returns an unparseable value untouched rather than NaN', () => {
    expect(formatLegalDeadline('not a date', 'uk', KYIV)).toBe('not a date')
  })
})
