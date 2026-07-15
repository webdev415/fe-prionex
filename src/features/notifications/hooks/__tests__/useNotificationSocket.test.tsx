/**
 * useNotificationSocket — handshake auth tests.
 *
 * Security invariant: the JWT must travel in the Socket.IO ``auth`` payload,
 * never in ``query`` — a token in the query string leaks into the WS upgrade
 * URL (browser console on a failed 401/502 handshake, proxy/access logs).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { useNotificationSocket } from '../useNotificationSocket'

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  io: { on: vi.fn() },
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

const TOKEN = 'test-jwt-token'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useNotificationSocket — handshake auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('prionex_token', TOKEN)
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('передаёт JWT через handshake auth, а не query/URL', () => {
    renderHook(() => useNotificationSocket(), { wrapper: createWrapper() })

    expect(io).toHaveBeenCalledTimes(1)
    const [url, opts] = vi.mocked(io).mock.calls[0]
    expect(opts?.auth).toEqual({ token: TOKEN })
    // Токен НЕ должен уходить в query/URL — иначе утечка в WS-upgrade URL.
    expect(opts?.query).toBeUndefined()
    expect(String(url)).not.toContain(TOKEN)
  })

  it('не открывает сокет без токена', () => {
    localStorage.removeItem('prionex_token')
    renderHook(() => useNotificationSocket(), { wrapper: createWrapper() })
    expect(io).not.toHaveBeenCalled()
  })
})
