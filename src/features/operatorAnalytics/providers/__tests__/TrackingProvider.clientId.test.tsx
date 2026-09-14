/**
 * One bad client id must not stall tracking.
 *
 * Analytics rejects a whole batch when any event in it carries a client id its
 * INTEGER column cannot hold, and the provider re-queues a rejected batch --
 * so a single stale URL once stopped every event the tab sent until a reload.
 * The provider is the one place every event passes through, so the id is
 * checked there, whoever sent it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useEffect } from 'react'
import { TrackingProvider } from '../TrackingProvider'
import { useTrackEvent } from '../../hooks/useTrackEvent'

const sent = vi.fn()
vi.mock('../../api/operatorAnalyticsService', () => ({
  ingestEvents: (payload: unknown) => {
    sent(payload)
    return Promise.resolve({ accepted: 0 })
  },
  buildIngestEventsBody: (payload: unknown) => JSON.stringify(payload),
}))

function Sender({ clientIds }: { clientIds: Array<number | null | undefined> }) {
  const trackEvent = useTrackEvent()
  useEffect(() => {
    for (const clientId of clientIds) trackEvent('client_card_tab_switch', { clientId })
  }, [clientIds, trackEvent])
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  sent.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

async function flushAfter(clientIds: Array<number | null | undefined>) {
  render(
    <TrackingProvider>
      <Sender clientIds={clientIds} />
    </TrackingProvider>
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6_000) // past the flush debounce
  })
  return sent.mock.calls.flatMap(([payload]) =>
    (payload as { events: Array<{ client_id: number | null }> }).events.map((e) => e.client_id)
  )
}

describe('TrackingProvider — client id at the door', () => {
  it('sends an out-of-range id as no client, and keeps the event', async () => {
    const ids = await flushAfter([5, 99999999999999, 0, 7])

    expect(ids).toEqual([5, null, null, 7])
  })

  it('leaves a real client id alone', async () => {
    expect(await flushAfter([2147483647])).toEqual([2147483647])
  })
})
