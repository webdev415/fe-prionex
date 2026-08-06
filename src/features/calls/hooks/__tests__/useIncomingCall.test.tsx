import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIncomingCall } from '../useIncomingCall'
import { getAccessToken } from '@/lib/api'
import type { IncomingCallEvent } from '../../types'

// The hook requires a JWT to open the authenticated Socket.IO handshake.
vi.mock('@/lib/api', () => ({
  getAccessToken: vi.fn(() => 'test-jwt-token'),
}))

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  io: {
    on: vi.fn(),
  },
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('useIncomingCall', () => {
  const mockAgentExtension = '1004'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAccessToken).mockReturnValue('test-jwt-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with no incoming call', () => {
    const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

    expect(result.current.incomingCall).toBeNull()
    expect(result.current.hasIncomingCall).toBe(false)
  })

  it('should not connect socket when agent extension is null', () => {
    renderHook(() => useIncomingCall(null))

    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  it('should not connect socket when no auth token is available', () => {
    vi.mocked(getAccessToken).mockReturnValue(null)

    renderHook(() => useIncomingCall(mockAgentExtension))

    // Without a JWT the server refuses the handshake, so the hook must not
    // open a socket at all.
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  it('should listen for call.incoming events', () => {
    renderHook(() => useIncomingCall(mockAgentExtension))

    expect(mockSocket.on).toHaveBeenCalledWith('call.incoming', expect.any(Function))
  })

  it('should store incoming call data when event received', async () => {
    const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

    const mockIncomingEvent: IncomingCallEvent = {
      event_type: 'call.incoming',
      data: {
        call_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_phone: '+380501234567',
        agent_extension: '1004',
        client_name: 'Коваленко Іван',
        loan_count: 2,
        total_debt: '8000.0',
        loans: [
          {
            loan_id: 456,
            contract_number: 'LOAN-2024-001',
            remaining_debt: '5000.0',
            status: 'active',
          },
        ],
      },
    }

    // Get the event handler that was registered
    const callIncomingHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'call.incoming'
    )?.[1]

    // Simulate incoming call event
    act(() => {
      callIncomingHandler(mockIncomingEvent)
    })

    await waitFor(() => {
      expect(result.current.incomingCall).toEqual(mockIncomingEvent.data)
      expect(result.current.hasIncomingCall).toBe(true)
    })
  })

  it('should clear incoming call when dismissed', async () => {
    const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

    const mockIncomingEvent: IncomingCallEvent = {
      event_type: 'call.incoming',
      data: {
        call_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_phone: '+380501234567',
        agent_extension: '1004',
        loan_count: 0,
        total_debt: '0',
        loans: [],
      },
    }

    const callIncomingHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'call.incoming'
    )?.[1]

    act(() => {
      callIncomingHandler(mockIncomingEvent)
    })

    await waitFor(() => {
      expect(result.current.hasIncomingCall).toBe(true)
    })

    // Dismiss the call
    act(() => {
      result.current.dismissIncomingCall()
    })

    await waitFor(() => {
      expect(result.current.incomingCall).toBeNull()
      expect(result.current.hasIncomingCall).toBe(false)
    })
  })

  it('should handle multiple incoming calls (replace with latest)', async () => {
    const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

    const firstCall: IncomingCallEvent = {
      event_type: 'call.incoming',
      data: {
        call_id: 'call-1',
        customer_phone: '+380501111111',
        agent_extension: '1004',
        loan_count: 0,
        total_debt: '0',
        loans: [],
      },
    }

    const secondCall: IncomingCallEvent = {
      event_type: 'call.incoming',
      data: {
        call_id: 'call-2',
        customer_phone: '+380502222222',
        agent_extension: '1004',
        loan_count: 1,
        total_debt: '5000',
        loans: [],
      },
    }

    const callIncomingHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'call.incoming'
    )?.[1]

    // First call
    act(() => {
      callIncomingHandler(firstCall)
    })

    await waitFor(() => {
      expect(result.current.incomingCall?.call_id).toBe('call-1')
    })

    // Second call should replace first
    act(() => {
      callIncomingHandler(secondCall)
    })

    await waitFor(() => {
      expect(result.current.incomingCall?.call_id).toBe('call-2')
      expect(result.current.incomingCall?.customer_phone).toBe('+380502222222')
    })
  })

  it('should cleanup socket listeners on unmount', () => {
    const { unmount } = renderHook(() => useIncomingCall(mockAgentExtension))

    expect(mockSocket.on).toHaveBeenCalled()

    unmount()

    expect(mockSocket.off).toHaveBeenCalledWith('call.incoming', expect.any(Function))
  })

  it('should provide call details in returned object', async () => {
    const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

    const mockIncomingEvent: IncomingCallEvent = {
      event_type: 'call.incoming',
      data: {
        call_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_phone: '+380501234567',
        agent_extension: '1004',
        client_name: 'Test Client',
        loan_count: 1,
        total_debt: '5000.0',
        loans: [
          {
            loan_id: 456,
            contract_number: 'LOAN-001',
            remaining_debt: '5000.0',
            status: 'active',
          },
        ],
      },
    }

    const callIncomingHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'call.incoming'
    )?.[1]

    act(() => {
      callIncomingHandler(mockIncomingEvent)
    })

    await waitFor(() => {
      expect(result.current.incomingCall).toBeDefined()
      expect(result.current.incomingCall?.customer_phone).toBe('+380501234567')
      expect(result.current.incomingCall?.client_name).toBe('Test Client')
      expect(result.current.incomingCall?.loan_count).toBe(1)
      expect(result.current.incomingCall?.loans).toHaveLength(1)
    })
  })

  it('should handle incoming call with no loans', async () => {
    const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

    const mockIncomingEvent: IncomingCallEvent = {
      event_type: 'call.incoming',
      data: {
        call_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_phone: '+380501234567',
        agent_extension: '1004',
        loan_count: 0,
        total_debt: '0',
        loans: [],
      },
    }

    const callIncomingHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'call.incoming'
    )?.[1]

    act(() => {
      callIncomingHandler(mockIncomingEvent)
    })

    await waitFor(() => {
      expect(result.current.incomingCall?.loan_count).toBe(0)
      expect(result.current.incomingCall?.loans).toEqual([])
      expect(result.current.hasIncomingCall).toBe(true)
    })
  })

  it('should disconnect socket when agent extension changes to null', () => {
    const { rerender } = renderHook(
      ({ agentExtension }: { agentExtension: string | null }) => useIncomingCall(agentExtension),
      {
        initialProps: { agentExtension: mockAgentExtension as string | null },
      }
    )

    expect(mockSocket.on).toHaveBeenCalled()

    // Change agent extension to null
    rerender({ agentExtension: null })

    expect(mockSocket.off).toHaveBeenCalled()
  })

  describe('a queue rings several operators at once', () => {
    const popup = (): IncomingCallEvent => ({
      event_type: 'call.incoming',
      data: {
        call_id: 'shared-call',
        customer_phone: '+380971234567',
        agent_extension: mockAgentExtension,
        loan_count: 0,
        total_debt: '0',
        loans: [],
      },
    })

    async function openPopup(result: { current: { hasIncomingCall: boolean } }) {
      const handler = mockSocket.on.mock.calls.find((c) => c[0] === 'call.incoming')?.[1]
      act(() => handler(popup()))
      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    }

    function stateHandler() {
      return mockSocket.on.mock.calls.find((c) => c[0] === 'call.state_changed')?.[1]
    }

    it('closes the window when a colleague answers', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'shared-call', state: 'ACTIVE', agent_extension: '2094' },
        })
      })

      // Leaving it open would show a live Answer button for a call already taken.
      await waitFor(() => expect(result.current.incomingCall).toBeNull())
    })

    it('keeps the window when this operator is the one who answered', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: {
            call_id: 'shared-call',
            state: 'ACTIVE',
            agent_extension: mockAgentExtension,
          },
        })
      })

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('keeps the window when the event says nothing about who answered', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'shared-call', state: 'ACTIVE' },
        })
      })

      // Closing on an ambiguous event would drop a call the operator may hold.
      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('leaves a different call alone when a colleague answers this one', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'a-different-call', state: 'ACTIVE', agent_extension: '2094' },
        })
      })

      // Two queue calls can be in flight; the hook shows the latest. Closing on
      // any ACTIVE would drop a call that is still ringing for this operator.
      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('leaves a different call alone when another call ends', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'a-different-call', state: 'COMPLETED' },
        })
      })

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('ignores a screen-pop for a call a colleague already took', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

      // The state event can outrun the screen-pop, which waits on a client
      // lookup. Opening a window here would strand it — the events that would
      // have closed it have already been delivered.
      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'shared-call', state: 'ACTIVE', agent_extension: '2094' },
        })
      })

      const incoming = mockSocket.on.mock.calls.find((c) => c[0] === 'call.incoming')?.[1]
      act(() => incoming(popup()))

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(false))
    })
  })
})
