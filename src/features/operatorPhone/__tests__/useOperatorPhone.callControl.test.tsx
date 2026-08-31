import { act, renderHook, waitFor } from '@testing-library/react'
import type { RefObject } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OPERATOR_PHONE_ORIGIN } from '../constants'
import { useOperatorPhone } from '../hooks/useOperatorPhone'
import {
  MSG_ANSWER,
  MSG_CALL_ANSWERED,
  MSG_CALL_ENDED,
  MSG_HANGUP,
  MSG_ROUTED_CALL,
  MSG_SET_AUTO_ANSWER,
  MSG_STATUS,
} from '../protocol'

vi.mock('../api/operatorPhoneService', () => ({
  issuePhoneToken: vi.fn(),
}))

// Under the Aggressive driver the CRM's own socket never sees `call_routed` —
// the dialer publishes it to the phone's presence socket only. These messages
// are the CRM's sole notice that a call arrived, and its only way to answer it,
// so the origin/source checks matter as much as the happy path.

function makeRef() {
  const postMessage = vi.fn()
  const contentWindow = { postMessage }
  const ref = {
    current: { contentWindow },
  } as unknown as RefObject<HTMLIFrameElement | null>
  return { ref, postMessage, contentWindow }
}

function post(origin: string, data: unknown, source?: unknown) {
  act(() => {
    const event = new MessageEvent('message', { origin, data })
    if (source !== undefined) {
      Object.defineProperty(event, 'source', { value: source, configurable: true })
    }
    window.dispatchEvent(event)
  })
}

const CALL = {
  call_id: 'c-1',
  client_id: 218882,
  client_name: 'Олена Коваленко',
  phone: '380501234567',
  campaign_id: 44,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useOperatorPhone call control', () => {
  it('surfaces a routed call relayed up by the phone', async () => {
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))
    expect(result.current.routedCall).toBeNull()

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: CALL }, contentWindow)

    await waitFor(() => expect(result.current.routedCall).toEqual(CALL))

    act(() => result.current.clearRoutedCall())
    await waitFor(() => expect(result.current.routedCall).toBeNull())
  })

  it('ignores a routed call from a foreign origin', () => {
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post('http://evil.example', { type: MSG_ROUTED_CALL, call: CALL }, contentWindow)

    expect(result.current.routedCall).toBeNull()
  })

  it('answers and hangs up through the phone, which owns the SIP session', () => {
    const { ref, postMessage } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    act(() => result.current.answerCall('c-1'))
    act(() => result.current.hangupCall('c-1'))

    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      { type: MSG_ANSWER, call_id: 'c-1' },
      OPERATOR_PHONE_ORIGIN
    )
    // Without a hangup the leg outlives the CRM panel and the customer stays
    // connected to an operator who has moved on to the next call.
    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      { type: MSG_HANGUP, call_id: 'c-1' },
      OPERATOR_PHONE_ORIGIN
    )
  })

  it('confirms an active call only when the phone says the leg is up', async () => {
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: CALL }, contentWindow)
    await waitFor(() => expect(result.current.routedCall).toEqual(CALL))
    expect(result.current.answeredCallId).toBeNull()

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_CALL_ANSWERED, call_id: 'c-1' }, contentWindow)
    await waitFor(() => expect(result.current.answeredCallId).toBe('c-1'))
  })

  it('reports the end without dropping the call', async () => {
    // The remote party hanging up is the common case and the CRM has no other
    // source for it. The call stays put: dropping it here would unmount the
    // active-call panel and discard the operator's unsaved interaction note
    // before wrap-up ever ran.
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: CALL }, contentWindow)
    await waitFor(() => expect(result.current.routedCall).not.toBeNull())

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_CALL_ENDED, call_id: 'c-1' }, contentWindow)
    await waitFor(() => expect(result.current.endedCallId).toBe('c-1'))
    expect(result.current.routedCall).toEqual(CALL)

    // The view clears it once wrap-up is done.
    act(() => result.current.clearRoutedCall())
    await waitFor(() => expect(result.current.routedCall).toBeNull())
    expect(result.current.endedCallId).toBeNull()
  })

  it('queues the next offer behind an unfinished wrap-up', async () => {
    // Overwriting the call being wrapped up unmounts the panel and takes the
    // operator's unsaved interaction note with it — the same loss the wrap-up
    // handling exists to prevent, reached from the other side.
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: CALL }, contentWindow)
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_CALL_ANSWERED, call_id: 'c-1' }, contentWindow)
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_CALL_ENDED, call_id: 'c-1' }, contentWindow)
    await waitFor(() => expect(result.current.endedCallId).toBe('c-1'))

    const next = { ...CALL, call_id: 'c-2' }
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: next }, contentWindow)

    // Still the call being wrapped up.
    expect(result.current.routedCall).toEqual(CALL)

    // Wrap-up done — the held offer takes over, with its own clean state.
    act(() => result.current.clearRoutedCall())
    await waitFor(() => expect(result.current.routedCall).toEqual(next))
    expect(result.current.answeredCallId).toBeNull()
    expect(result.current.endedCallId).toBeNull()
  })

  it('replaces an unanswered offer rather than queueing behind it', async () => {
    // Nothing to wrap up when the operator never took the call.
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: CALL }, contentWindow)
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_CALL_ENDED, call_id: 'c-1' }, contentWindow)

    const next = { ...CALL, call_id: 'c-2' }
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: next }, contentWindow)

    await waitFor(() => expect(result.current.routedCall).toEqual(next))
  })

  it('drops a stale end when the next call arrives', async () => {
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: CALL }, contentWindow)
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_CALL_ENDED, call_id: 'c-1' }, contentWindow)
    await waitFor(() => expect(result.current.endedCallId).toBe('c-1'))

    // The next call must not inherit the previous call's ended state.
    const next = { ...CALL, call_id: 'c-2' }
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_ROUTED_CALL, call: next }, contentWindow)
    await waitFor(() => expect(result.current.routedCall).toEqual(next))
    expect(result.current.endedCallId).toBeNull()
  })

  it('re-establishes the auto-answer preference every time the phone is ready', async () => {
    // A reload on either side of the frame otherwise leaves the phone acting on
    // a stale setting while the CRM displays the current one.
    const { ref, postMessage, contentWindow } = makeRef()
    const { rerender } = renderHook(({ autoAnswer }) => useOperatorPhone(ref, { autoAnswer }), {
      initialProps: { autoAnswer: true },
    })

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_STATUS, status: 'ready' }, contentWindow)
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { type: MSG_SET_AUTO_ANSWER, enabled: true },
        OPERATOR_PHONE_ORIGIN
      )
    )

    postMessage.mockClear()
    rerender({ autoAnswer: false })
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { type: MSG_SET_AUTO_ANSWER, enabled: false },
        OPERATOR_PHONE_ORIGIN
      )
    )

    // A re-registration re-pushes without the operator touching anything.
    postMessage.mockClear()
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_STATUS, status: 'offline' }, contentWindow)
    post(OPERATOR_PHONE_ORIGIN, { type: MSG_STATUS, status: 'ready' }, contentWindow)
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { type: MSG_SET_AUTO_ANSWER, enabled: false },
        OPERATOR_PHONE_ORIGIN
      )
    )
  })
})
