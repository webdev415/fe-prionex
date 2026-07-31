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
  const ref = {
    current: { contentWindow: { postMessage } },
  } as unknown as RefObject<HTMLIFrameElement | null>
  return { ref, postMessage }
}

function post(origin: string, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { origin, data }))
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
    const { ref, postMessage } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_READY_FOR_TOKEN })

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
    const { ref } = makeRef()
    renderHook(() => useOperatorPhone(ref))

    post('http://evil.example', { type: MSG_READY_FOR_TOKEN })

    expect(mockedIssue).not.toHaveBeenCalled()
  })

  it('reflects status updates reported by the phone', async () => {
    const { ref } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))
    expect(result.current.status).toBe('offline')

    post(OPERATOR_PHONE_ORIGIN, {
      type: MSG_STATUS,
      status: 'ready',
      aor: 'operator-c22-u63',
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.aor).toBe('operator-c22-u63')
  })

  it('surfaces an error status when minting fails', async () => {
    mockedIssue.mockRejectedValue(new Error('boom'))
    const { ref } = makeRef()
    const { result } = renderHook(() => useOperatorPhone(ref))

    post(OPERATOR_PHONE_ORIGIN, { type: MSG_READY_FOR_TOKEN })

    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})
