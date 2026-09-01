/**
 * What happens to a half-written interaction when the next queue call arrives.
 *
 * The queue's wrap-up time is seconds and a write-up takes longer, so this is
 * ordinary rather than exceptional. PM's decision: let the new call through,
 * and tell the operator the previous write-up was not saved — never block a
 * call, never let them assume it filed.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { IncomingCallWindowContainer } from '../IncomingCallWindowContainer'
import { hasUnfiledWriteUp } from '../../utils/writeUp'
import type { IncomingCallData } from '../../types'

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })

vi.mock('@/features/clients/hooks/useNoteInteraction', () => ({
  useInteractionTypes: () => ({ data: [{ id: 1, code: 'incoming', name: 'Incoming' }] }),
  useInteractionContactTypes: () => ({ data: [] }),
  // Two, so a test can actually change the selection — Radix fires no change
  // when you pick the option that is already selected.
  useInteractionSubtypes: () => ({
    data: [
      { id: 9, name: 'Call' },
      { id: 10, name: 'Messenger' },
    ],
  }),
  useInteractionResults: () => ({ data: [{ id: 4, name: 'Refusal' }] }),
  useCreateBulkInteraction: () => mutation(),
}))
vi.mock('../../hooks/useCall', () => ({
  useAnswerCall: () => mutation(),
  useHoldCall: () => mutation(),
  useRejectCall: () => mutation(),
  useHangupCall: () => mutation(),
  useCallDetails: () => ({ data: undefined }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const call: IncomingCallData = {
  call_id: 'call-1',
  customer_phone: '+380971234567',
  agent_extension: '2091',
  client_id: 25,
  client_name: 'Кондратюк Наталія',
  loan_count: 0,
  total_debt: '0',
  loans: [],
}

function renderWith(draftReported: (callId: string, unfiled: boolean) => void, ended = false) {
  return render(
    <IncomingCallWindowContainer
      incomingCall={call}
      answeredAt={Date.now()}
      onAnswered={vi.fn()}
      agentExtension="2091"
      minimized={false}
      onMinimize={vi.fn()}
      ended={ended}
      onUnsavedChange={draftReported}
      onDismiss={vi.fn()}
    />
  )
}

describe('reporting an unfiled write-up', () => {
  beforeEach(() => vi.clearAllMocks())

  it('says nothing while the form is untouched', () => {
    const reported = vi.fn()
    renderWith(reported)

    expect(reported).toHaveBeenCalledWith(call.call_id, false)
    expect(reported).not.toHaveBeenCalledWith(call.call_id, true)
  })

  it('reports work the operator has actually entered', async () => {
    const reported = vi.fn()
    renderWith(reported)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Promised Friday' } })

    await waitFor(() => expect(reported).toHaveBeenCalledWith(call.call_id, true))
  })
})

describe('what counts as an unfiled write-up', () => {
  it('is nothing on an untouched form', () => {
    expect(hasUnfiledWriteUp({}, false)).toBe(false)
  })

  it('is not the communication channel on its own', () => {
    // The form defaults the channel to the first option and reports it as soon
    // as the operator opens that select, so counting it would warn on calls
    // where nothing was written at all.
    expect(hasUnfiledWriteUp({ channelId: 10 }, false)).toBe(false)
  })

  it('is a result, a reason or a comment', () => {
    expect(hasUnfiledWriteUp({ resultId: 4 }, false)).toBe(true)
    expect(hasUnfiledWriteUp({ reasonId: 2 }, false)).toBe(true)
    expect(hasUnfiledWriteUp({ comment: 'Promised Friday' }, false)).toBe(true)
  })

  it('is not whitespace', () => {
    expect(hasUnfiledWriteUp({ comment: '   ' }, false)).toBe(false)
  })

  it('is nothing once it has been filed', () => {
    expect(hasUnfiledWriteUp({ resultId: 4, comment: 'Saved' }, true)).toBe(false)
  })
})
