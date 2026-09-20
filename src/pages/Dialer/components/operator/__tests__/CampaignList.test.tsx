/**
 * What an operator sees for a campaign the calling window is holding.
 *
 * The window leaves the supervisor's own switch on, so the queue resumes by
 * itself. Rendering it as "Inactive" tells the operator someone turned it off,
 * which sends them to ask about a campaign that needs nothing done.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DialerQueue } from '@/features/dialer/types'
import { CampaignList } from '../CampaignList'

const campaign = (over: Partial<DialerQueue>) =>
  ({
    id: 1,
    name: 'Spain campaign',
    is_active: true,
    status: 'active',
    ...over,
  }) as DialerQueue

function renderWith(c: DialerQueue) {
  render(<CampaignList campaigns={[c]} selectedId={null} joinedId={null} onSelect={vi.fn()} />)
}

describe('CampaignList status', () => {
  it('names a window hold rather than calling it inactive', () => {
    renderWith(campaign({ status: 'paused_calling_window', paused_by_window: true }))
    expect(screen.getByText('dialer.queueStatus.pausedCallingWindow')).toBeInTheDocument()
    expect(screen.queryByText('dialer.queueStatus.inactive')).toBeNull()
  })

  it('still shows a switched-off campaign as inactive', () => {
    renderWith(campaign({ status: 'inactive', is_active: false }))
    expect(screen.getByText('dialer.queueStatus.inactive')).toBeInTheDocument()
  })

  it('falls back to inactive for a status it has never heard of', () => {
    // Drivers can write arbitrary values; the compile-time check cannot see
    // those, so the runtime fallback still has to hold.
    renderWith(campaign({ status: 'something_new' as DialerQueue['status'] }))
    expect(screen.getByText('dialer.queueStatus.inactive')).toBeInTheDocument()
  })
})
