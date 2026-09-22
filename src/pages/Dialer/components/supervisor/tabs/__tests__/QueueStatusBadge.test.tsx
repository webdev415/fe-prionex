import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { QueueStatusBadge } from '../QueueListTab'

// Campaign sync is fail-soft: a queue with no campaign upstream renders like any
// other and cannot place a single call, with the only previous trace a warning
// in a container log. The tri-state matters — `undefined` is an older payload or
// the fake driver (which never provisions a campaign) and must stay silent.
describe('QueueStatusBadge', () => {
  it('warns when the queue is known to have no campaign upstream', () => {
    render(<QueueStatusBadge active synced={false} />)
    expect(screen.getByText('dialer.queueList.notSynced')).toBeTruthy()
    // The sync problem outranks Active — the queue cannot dial either way.
    expect(screen.queryByText('statusLabels.active')).toBeNull()
  })

  it('still warns when an unsynced queue is also inactive', () => {
    render(<QueueStatusBadge active={false} synced={false} />)
    expect(screen.getByText('dialer.queueList.notSynced')).toBeTruthy()
  })

  it('shows the normal status when the queue is synced', () => {
    render(<QueueStatusBadge active synced />)
    expect(screen.getByText('statusLabels.active')).toBeTruthy()
    expect(screen.queryByText('dialer.queueList.notSynced')).toBeNull()
  })

  it('stays silent when sync state is unknown', () => {
    // An older payload, or the fake driver — not evidence of a problem.
    render(<QueueStatusBadge active />)
    expect(screen.getByText('statusLabels.active')).toBeTruthy()
    expect(screen.queryByText('dialer.queueList.notSynced')).toBeNull()

    render(<QueueStatusBadge active={false} />)
    expect(screen.getByText('statusLabels.inactive')).toBeTruthy()
  })

  it('shows a window hold rather than a healthy Active queue', () => {
    // The supervisor's toggle still says on, so without its own pill this
    // queue looks perfectly normal while deliberately placing no calls — and
    // the supervisor goes hunting for a fault that is not there.
    render(<QueueStatusBadge active pausedByWindow />)
    expect(screen.getByText('dialer.queueList.pausedByWindow')).toBeInTheDocument()
    expect(screen.queryByText('statusLabels.active')).toBeNull()
  })

  it('lets a missing campaign outrank the window hold', () => {
    // Not synced is a fault needing action; a window hold is not. If both are
    // true the actionable one has to win.
    render(<QueueStatusBadge active synced={false} pausedByWindow />)
    expect(screen.getByText('dialer.queueList.notSynced')).toBeInTheDocument()
  })

  it('is unaffected when the window is not holding the queue', () => {
    render(<QueueStatusBadge active pausedByWindow={false} />)
    expect(screen.getByText('statusLabels.active')).toBeInTheDocument()
  })
})
