/**
 * useCallWebSocket Hook Tests
 *
 * Tests for WebSocket hook that manages real-time call state updates.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCallWebSocket } from '../useCallWebSocket'
import type { CallStateEvent } from '../../types'

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  io: {
    on: vi.fn(),
  },
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

vi.mock('sonner')

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

describe('useCallWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should connect to WebSocket when agent extension is provided', () => {
    const agentExtension = '1003'

    renderHook(() => useCallWebSocket(agentExtension), { wrapper: createWrapper() })

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('call.state.changed', expect.any(Function))
  })

  it('should not connect when agent extension is null', () => {
    renderHook(() => useCallWebSocket(null), { wrapper: createWrapper() })

    // Socket should not be created
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it('should emit join event on connection', () => {
    const agentExtension = '1003'

    renderHook(() => useCallWebSocket(agentExtension), { wrapper: createWrapper() })

    // Simulate connection
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
    connectHandler?.()

    expect(mockSocket.emit).toHaveBeenCalledWith('join', { agent_extension: agentExtension })
  })

  it('should update connection status on connect', async () => {
    const agentExtension = '1003'

    const { result } = renderHook(() => useCallWebSocket(agentExtension), {
      wrapper: createWrapper(),
    })

    // Simulate connection
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
    connectHandler?.()

    await waitFor(() => {
      expect(result.current.connected).toBe(true)
      expect(result.current.reconnecting).toBe(false)
    })
  })

  it('should update connection status on disconnect', () => {
    const agentExtension = '1003'

    const { result } = renderHook(() => useCallWebSocket(agentExtension), {
      wrapper: createWrapper(),
    })

    // First connect
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1]
    connectHandler?.()

    // Then disconnect
    const disconnectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'disconnect')?.[1]
    disconnectHandler?.()

    expect(result.current.connected).toBe(false)
  })

  it('should handle call state change events', async () => {
    const agentExtension = '1003'
    const mockEvent: CallStateEvent = {
      event_type: 'call.state.changed',
      call_id: 'CALL-123',
      current_state: 'ACTIVE',
      data: {
        call_id: 'CALL-123',
        state: 'ACTIVE',
        duration: 120,
      },
    }

    const queryClient = new QueryClient()
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    renderHook(() => useCallWebSocket(agentExtension), { wrapper })

    // Simulate call state changed event
    const stateChangeHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'call.state.changed'
    )?.[1]
    stateChangeHandler?.(mockEvent)

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['callDetails', 'CALL-123'],
      })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['callHistory'],
      })
    })
  })

  it('should show reconnecting notification after 3 failed attempts', () => {
    const agentExtension = '1003'

    renderHook(() => useCallWebSocket(agentExtension), { wrapper: createWrapper() })

    // Simulate reconnection attempts
    const reconnectAttemptHandler = mockSocket.io.on.mock.calls.find(
      (call) => call[0] === 'reconnect_attempt'
    )?.[1]

    reconnectAttemptHandler?.(3)

    expect(toast.info).toHaveBeenCalledWith('Reconnecting to call service...')
  })

  it('should enable polling fallback after max reconnect attempts', async () => {
    const agentExtension = '1003'

    const { result } = renderHook(() => useCallWebSocket(agentExtension), {
      wrapper: createWrapper(),
    })

    // Simulate exceeding max reconnect attempts
    const reconnectAttemptHandler = mockSocket.io.on.mock.calls.find(
      (call) => call[0] === 'reconnect_attempt'
    )?.[1]

    reconnectAttemptHandler?.(11) // More than MAX_RECONNECT_ATTEMPTS (10)

    await waitFor(() => {
      expect(result.current.usingPollingFallback).toBe(true)
      expect(toast.warning).toHaveBeenCalledWith('Using fallback mode for call updates')
    })
  })

  it('should show success notification on reconnect', () => {
    const agentExtension = '1003'

    renderHook(() => useCallWebSocket(agentExtension), { wrapper: createWrapper() })

    // Simulate successful reconnection
    const reconnectHandler = mockSocket.io.on.mock.calls.find(
      (call) => call[0] === 'reconnect'
    )?.[1]

    reconnectHandler?.()

    expect(toast.success).toHaveBeenCalledWith('Connected to call service')
  })

  it('should disconnect socket on unmount', () => {
    const agentExtension = '1003'

    const { unmount } = renderHook(() => useCallWebSocket(agentExtension), {
      wrapper: createWrapper(),
    })

    unmount()

    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('should disconnect and reconnect when agent extension changes', () => {
    const { rerender } = renderHook(({ extension }) => useCallWebSocket(extension), {
      wrapper: createWrapper(),
      initialProps: { extension: '1003' },
    })

    expect(mockSocket.on).toHaveBeenCalled()

    // Change extension
    rerender({ extension: '1004' })

    // Should disconnect old socket and create new one
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('should handle reconnection errors gracefully', () => {
    const agentExtension = '1003'
    const mockError = new Error('Connection failed')

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderHook(() => useCallWebSocket(agentExtension), { wrapper: createWrapper() })

    // Simulate reconnection error
    const reconnectErrorHandler = mockSocket.io.on.mock.calls.find(
      (call) => call[0] === 'reconnect_error'
    )?.[1]

    reconnectErrorHandler?.(mockError)

    expect(consoleSpy).toHaveBeenCalledWith('Reconnection error:', mockError)

    consoleSpy.mockRestore()
  })

  it('should handle reconnection failure', async () => {
    const agentExtension = '1003'

    const { result } = renderHook(() => useCallWebSocket(agentExtension), {
      wrapper: createWrapper(),
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Simulate reconnection failure
    const reconnectFailedHandler = mockSocket.io.on.mock.calls.find(
      (call) => call[0] === 'reconnect_failed'
    )?.[1]

    reconnectFailedHandler?.()

    await waitFor(() => {
      expect(result.current.usingPollingFallback).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith('Reconnection failed after max attempts')
    })

    consoleSpy.mockRestore()
  })

  it('should handle multiple state change events', async () => {
    const agentExtension = '1003'
    const mockEvents: CallStateEvent[] = [
      {
        event_type: 'call.state.changed',
        call_id: 'CALL-123',
        current_state: 'RINGING',
        data: { call_id: 'CALL-123', state: 'RINGING' },
      },
      {
        event_type: 'call.state.changed',
        call_id: 'CALL-123',
        current_state: 'ACTIVE',
        data: { call_id: 'CALL-123', state: 'ACTIVE' },
      },
      {
        event_type: 'call.state.changed',
        call_id: 'CALL-123',
        current_state: 'COMPLETED',
        data: { call_id: 'CALL-123', state: 'COMPLETED' },
      },
    ]

    const queryClient = new QueryClient()
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    renderHook(() => useCallWebSocket(agentExtension), { wrapper })

    const stateChangeHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'call.state.changed'
    )?.[1]

    // Simulate multiple events
    for (const event of mockEvents) {
      stateChangeHandler?.(event)
    }

    await waitFor(() => {
      // Should invalidate queries for each event
      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(mockEvents.length * 2) // 2 invalidations per event
    })
  })
})
