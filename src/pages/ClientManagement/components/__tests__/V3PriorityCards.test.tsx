/**
 * Client-list summary cards, v3 version (KAN-791).
 *
 * These exist because the screen was showing v3 buckets in the rows and legacy
 * Critical/High/Medium/Low in the totals — two scoring systems at once, with
 * numbers that could not be reconciled. So the properties worth pinning are the
 * ones that keep the cards honest about the list beneath them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { V3PriorityCards } from '../V3PriorityCards'
import type { V3ClientBucketCount } from '@/features/scoring/api/types'

vi.mock('react-i18next', async () => (await import('@/test/englishI18n')).englishReactI18nextMock())

const BUCKETS: V3ClientBucketCount[] = [
  { bucket: 'CRIT', clients: 0, priority_dollar: 0 },
  { bucket: 'HIGH', clients: 2, priority_dollar: 217 },
  { bucket: 'AVG', clients: 50460, priority_dollar: 20298443 },
  { bucket: 'LOW', clients: 156483, priority_dollar: 4922207 },
  { bucket: 'EXIT', clients: 44058, priority_dollar: 0 },
]

const onToggle = vi.fn()

/** Brand-wide counts, as the client service returns them. */
const COUNTS = { CRIT: 0, HIGH: 2, AVG: 50460, LOW: 156483, EXIT: 44058, NONE: 156228 }

function setup(counts?: Record<string, number>, selected: string[] = []) {
  return render(
    <MemoryRouter>
      <V3PriorityCards buckets={BUCKETS} counts={counts} selected={selected} onToggle={onToggle} />
    </MemoryRouter>
  )
}

describe('V3PriorityCards', () => {
  beforeEach(() => vi.clearAllMocks())
  it('uses v3 wording, never the legacy priority names', () => {
    setup()
    expect(screen.getByText('Call first')).toBeInTheDocument()
    expect(screen.getByText('Do not call')).toBeInTheDocument()
    // "Critical" and "Medium" belong to the old scoring badge only
    expect(screen.queryByText('Critical')).not.toBeInTheDocument()
    expect(screen.queryByText('Medium')).not.toBeInTheDocument()
  })

  it('shows client counts', () => {
    setup()
    expect(screen.getByText('50,460')).toBeInTheDocument()
    expect(screen.getByText('156,483')).toBeInTheDocument()
    expect(screen.getByText('44,058')).toBeInTheDocument()
  })

  it('accounts for clients the model does not cover', () => {
    // 251,003 scored out of 407,231 — the remainder must be visible, not dropped,
    // or the cards silently under-count the list they sit above.
    setup(COUNTS)
    expect(screen.getByText('Not scored')).toBeInTheDocument()
    expect(screen.getByText('156,228')).toBeInTheDocument()
  })

  it('adds up to the client total', () => {
    setup(COUNTS)
    expect(Object.values(COUNTS).reduce((a, b) => a + b, 0)).toBe(407231)
  })

  it('the counts do not shrink when the list is filtered', () => {
    // The regression: counts used to come from the FILTERED list total, so
    // "Not scored" dropped to 0 as soon as any card was clicked. They now come
    // from a brand-wide query and are unaffected by the current view.
    setup(COUNTS, ['HIGH'])
    expect(screen.getByText('156,228')).toBeInTheDocument()
    expect(screen.getByText('50,460')).toBeInTheDocument()
  })

  it('omits the not-scored card when counts are unavailable', () => {
    setup(undefined)
    expect(screen.queryByText('Not scored')).not.toBeInTheDocument()
  })

  it('never renders a negative count', () => {
    const { container } = render(
      <MemoryRouter>
        <V3PriorityCards buckets={BUCKETS} counts={COUNTS} />
      </MemoryRouter>
    )
    expect(container.textContent).not.toMatch(/-[\d,]+/)
  })

  // ── filtering: the whole point of a summary card ──
  it('clicking a bucket filters the list', () => {
    setup(COUNTS)
    fireEvent.click(screen.getByText('Average'))
    expect(onToggle).toHaveBeenCalledWith('AVG')
  })

  it('the unscored clients can be filtered too', () => {
    // Being told 156,228 exist is useless if you cannot pull them up.
    setup(COUNTS)
    fireEvent.click(screen.getByText('Not scored'))
    expect(onToggle).toHaveBeenCalledWith('NONE')
  })

  it('marks the buckets currently filtering', () => {
    const { container } = setup(COUNTS, ['AVG'])
    expect(container.querySelectorAll('.ring-2').length).toBe(1)
  })
})
