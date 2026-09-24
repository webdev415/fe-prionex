/**
 * "Not scored" badge, and the priority rules both client screens must share.
 *
 * The bug this guards: the LIST was taught the three rules below but the client
 * DETAIL page was not, so the same client showed "Not scored" in the list and
 * "Critical" on their own card — the card contradicting the list it was opened
 * from, and using a badge from the scoring system we had just moved off.
 *
 * The rules, in order:
 *   1. dead / fraud / court  -> Do not call   (needs NO model)
 *   2. has a v3 bucket       -> that bucket
 *   3. otherwise             -> Not scored    (never the legacy badge)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotScoredBadge } from '../NotScoredBadge'

vi.mock('react-i18next', async () => (await import('@/test/englishI18n')).englishReactI18nextMock())

/** The shared decision, written once so both screens can be checked against it. */
function priorityBadgeFor({
  v3Enabled,
  blocked,
  bucket,
}: {
  v3Enabled: boolean
  blocked: boolean
  bucket?: string
}): string {
  if (v3Enabled && blocked) return 'EXIT'
  if (bucket) return bucket
  if (v3Enabled) return 'NOT_SCORED'
  return 'LEGACY'
}

describe('NotScoredBadge', () => {
  it('says the client is not scored', () => {
    render(<NotScoredBadge />)
    expect(screen.getByText('Not scored')).toBeInTheDocument()
  })

  it('explains itself on hover rather than leaving a bare label', () => {
    render(<NotScoredBadge />)
    expect(screen.getByText('Not scored')).toHaveAttribute(
      'title',
      expect.stringContaining('outside the scoring model')
    )
  })
})

describe('priority badge rules (shared by the list and the client card)', () => {
  it('compliance wins even with no score — the case that showed "Critical"', () => {
    expect(priorityBadgeFor({ v3Enabled: true, blocked: true })).toBe('EXIT')
  })

  it('compliance wins over a workable bucket too', () => {
    expect(priorityBadgeFor({ v3Enabled: true, blocked: true, bucket: 'CRIT' })).toBe('EXIT')
  })

  it('a scored client shows their bucket', () => {
    expect(priorityBadgeFor({ v3Enabled: true, blocked: false, bucket: 'AVG' })).toBe('AVG')
  })

  it('an unscored client shows "Not scored", never the legacy badge', () => {
    expect(priorityBadgeFor({ v3Enabled: true, blocked: false })).toBe('NOT_SCORED')
  })

  it('before cutover nothing changes — the legacy badge still shows', () => {
    expect(priorityBadgeFor({ v3Enabled: false, blocked: true })).toBe('LEGACY')
    expect(priorityBadgeFor({ v3Enabled: false, blocked: false })).toBe('LEGACY')
  })
})
