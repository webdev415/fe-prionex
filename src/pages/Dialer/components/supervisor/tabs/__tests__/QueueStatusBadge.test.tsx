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
})
