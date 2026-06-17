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
})
