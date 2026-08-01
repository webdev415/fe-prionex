import { act, renderHook, waitFor } from '@testing-library/react'
import type { RefObject } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OPERATOR_PHONE_ORIGIN } from '../constants'
import { useOperatorPhone } from '../hooks/useOperatorPhone'
import { MSG_READY_FOR_TOKEN, MSG_STATUS, MSG_TOKEN } from '../protocol'

vi.mock('../api/operatorPhoneService', () => ({
  issuePhoneToken: vi.fn(),
}))

import { issuePhoneToken } from '../api/operatorPhoneService'

const mockedIssue = vi.mocked(issuePhoneToken)

function makeRef() {
  const postMessage = vi.fn()
  const contentWindow = { postMessage }
  const ref = {
    current: { contentWindow },
  } as unknown as RefObject<HTMLIFrameElement | null>
  return { ref, postMessage, contentWindow }
}

/** Dispatch a message; `source` defaults to the ref's contentWindow (trusted). */
function post(origin: string, data: unknown, source?: unknown) {
  act(() => {
    const event = new MessageEvent('message', { origin, data })
    if (source !== undefined) {
      Object.defineProperty(event, 'source', { value: source, configurable: true })
    }
    window.dispatchEvent(event)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useOperatorPhone', () => {
  it('mints and posts a token when the phone signals ready', async () => {
    mockedIssue.mockResolvedValue({
      access_token: 'JWT',
      aor: 'operator-c22-u63',
      token_type: 'Bearer',
      expires_in: 3600,
    })
    const { ref, postMessage, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_READY_FOR_TOKEN }, contentWindow)

    await waitFor(() => expect(mockedIssue).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { type: MSG_TOKEN, token: 'JWT' },
        OPERATOR_PHONE_ORIGIN
      )
    )
    await waitFor(() => expect(result.current.aor).toBe('operator-c22-u63'))
  })

  it('ignores messages from a foreign origin', () => {
    const { ref, contentWindow } = makeRef()
    renderHook(() => useOperatorPhone(ref))

    post('http://evil.example', { type: MSG_READY_FOR_TOKEN }, contentWindow)

    expect(mockedIssue).not.toHaveBeenCalled()
  })

  it('ignores messages from an untrusted source frame (right origin, wrong window)', () => {
    const { ref } = makeRef()
    renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_READY_FOR_TOKEN }, { postMessage: vi.fn() })

    expect(mockedIssue).not.toHaveBeenCalled()
  })

  it('reflects status updates and clears the AOR when offline', async () => {
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))
    expect(result.current.status).toBe('offline')

    post(
      OPERATOR_PHONE_ORIGIN,
      { type: MSG_STATUS, status: 'ready', aor: 'operator-c22-u63' },
      contentWindow
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.aor).toBe('operator-c22-u63')

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_STATUS, status: 'offline' }, contentWindow)
    await waitFor(() => expect(result.current.status).toBe('offline'))
    expect(result.current.aor).toBeNull()
  })

  it('retries a transient mint failure before surfacing error', async () => {
    vi.useFakeTimers()
    mockedIssue.mockRejectedValue(new Error('boom'))
    const { ref, contentWindow } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_READY_FOR_TOKEN }, contentWindow)
    // Flush the retry backoff timers + their microtasks inside act so the
    // resulting state update is applied before we assert.
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockedIssue).toHaveBeenCalledTimes(3)
    expect(result.current.status).toBe('error')
    vi.useRealTimers()
  })
})
