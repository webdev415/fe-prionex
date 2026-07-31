import { describe, expect, it } from 'vitest'

import { DialerMockService } from '../api/dialerMockService'

describe('DialerMockService', () => {
  it('lists the operator campaigns from fixtures', async () => {
    const svc = new DialerMockService()
    const queues = await svc.listQueues()
    expect(queues.length).toBeGreaterThanOrEqual(17)
    expect(queues[0].name).toBe('Cold Calling - May 2026')
    expect(queues[0].aggressiveness).toBe(3)
  })

  it('starts a session as not_connected and joins/leaves', async () => {
    const svc = new DialerMockService()
    expect((await svc.getMySession()).status).toBe('not_connected')

    const joined = await svc.joinQueue(1, true)
    expect(joined.queue_id).toBe(1)
    expect(joined.status).toBe('active')
    expect(joined.auto_connect).toBe(true)
    expect((await svc.getMySession()).queue_id).toBe(1)

    await svc.leaveQueue()
    const after = await svc.getMySession()
    expect(after.queue_id).toBeNull()
    expect(after.status).toBe('not_connected')
  })

  it('joining an empty queue reports paused', async () => {
    const svc = new DialerMockService()
    const joined = await svc.joinQueue(3, false)
    expect(joined.status).toBe('paused')
  })

  it('returns a full client call summary for a known fixture client', async () => {
    const svc = new DialerMockService()
    const summary = await svc.getClientCallSummary(900001)
    expect(summary.status).toBe('active')
    expect(summary.progress_pct).toBe(15)
    expect(summary.total_payments).toEqual({ amount: 125450, count: 23 })
    expect(summary.verified.count).toBe(20)
    expect(summary.pending.count).toBe(3)
    expect(summary.loan?.number).toBe('#1026289')
    expect(summary.recent_interactions).toHaveLength(3)
  })

  it('falls back to an empty summary for an unknown client', async () => {
    const svc = new DialerMockService()
    const summary = await svc.getClientCallSummary(123)
    expect(summary.status).toBe('inactive')
    expect(summary.total_paid).toBe(0)
    expect(summary.recent_interactions).toHaveLength(0)
  })
})
