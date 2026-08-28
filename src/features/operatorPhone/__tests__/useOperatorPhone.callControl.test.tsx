import { act, renderHook, waitFor } from '@testing-library/react'
import type { RefObject } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OPERATOR_PHONE_ORIGIN } from '../constants'
import { useOperatorPhone } from '../hooks/useOperatorPhone'
import { MSG_ANSWER, MSG_ROUTED_CALL, MSG_SET_AUTO_ANSWER } from '../protocol'

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

  it('answers through the phone, which owns the SIP session', () => {
    const { ref, postMessage } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    act(() => result.current.answerCall())

    expect(postMessage).toHaveBeenCalledWith({ type: MSG_ANSWER }, OPERATOR_PHONE_ORIGIN)
  })

  it('pushes the auto-connection preference down in both directions', () => {
    const { ref, postMessage } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    act(() => result.current.setAutoAnswer(true))
    act(() => result.current.setAutoAnswer(false))

    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      { type: MSG_SET_AUTO_ANSWER, enabled: true },
      OPERATOR_PHONE_ORIGIN
    )
    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      { type: MSG_SET_AUTO_ANSWER, enabled: false },
      OPERATOR_PHONE_ORIGIN
    )
  })
})
