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
    // Several cases deliberately exercise the missing-answered_by path, which
    // logs by design; keep the run output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
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
          data: { call_id: 'shared-call', state: 'ACTIVE', answered_by: '2094' },
        })
      })

      // Leaving it open would keep a call this operator can no longer take on
      // screen, with nothing left to arrive that would close it.
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
            answered_by: mockAgentExtension,
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
          data: { call_id: 'a-different-call', state: 'ACTIVE', answered_by: '2094' },
        })
      })

      // Two queue calls can be in flight; the hook shows the latest. Closing on
      // any ACTIVE would drop a call that is still ringing for this operator.
      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it.each(['COMPLETED', 'FAILED'] as const)(
      'closes the window when this call reaches %s',
      async (state) => {
        const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
        await openPopup(result)

        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: { call_id: 'shared-call', state },
          })
        })

        // The original reason this hook listens to state changes at all: the
        // caller gives up or the call ends and the window has to go.
        await waitFor(() => expect(result.current.incomingCall).toBeNull())
      }
    )

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
          data: { call_id: 'shared-call', state: 'ACTIVE', answered_by: '2094' },
        })
      })

      const incoming = mockSocket.on.mock.calls.find((c) => c[0] === 'call.incoming')?.[1]
      act(() => incoming(popup()))

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(false))
    })

    it('closes on the answer signal even while the state still says ringing', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      // This is what the backend actually emits at DialEnd(ANSWER): the outcome
      // is already 'answered' but the record has not reached ACTIVE yet.
      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: {
            call_id: 'shared-call',
            state: 'RINGING',
            outcome: 'answered',
            answered_by: '2094',
          },
        })
      })

      await waitFor(() => expect(result.current.incomingCall).toBeNull())
    })

    it('stays open while ringing with no answer recorded', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'shared-call', state: 'RINGING', answered_by: '2094' },
        })
      })

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it("does not close the answerer's own window when the record still names the first leg", async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      // The queue rang 2093 first, then this operator, who answered. Until the
      // answering leg is adopted the record still says 2093 — reading that as
      // "who answered" would close the window of the person holding the call.
      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: {
            call_id: 'shared-call',
            state: 'RINGING',
            outcome: 'answered',
            // Stale: the queue rang 2093 first; this operator answered.
            agent_extension: '2093',
            answered_by: mockAgentExtension,
          },
        })
      })

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('leaves every window open when the answerer cannot be identified', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      // No answered_by: somebody picked up but the channel did not parse.
      // Guessing here would close the wrong window.
      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: {
            call_id: 'shared-call',
            state: 'RINGING',
            outcome: 'answered',
            // Names a colleague, but only as the record's current agent — which
            // is the first-rung leg, not necessarily who picked up.
            agent_extension: '2093',
          },
        })
      })

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('closes nothing when the event names no call', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { state: 'COMPLETED' },
        })
      })

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    describe('telling the consumer a call is over', () => {
      it.each(['COMPLETED', 'FAILED', 'CANCELLED'] as const)(
        'reports the call id on %s',
        async (state) => {
          const onCallSettled = vi.fn()
          renderHook(() => useIncomingCall(mockAgentExtension, { onCallSettled }))

          act(() => {
            stateHandler()({
              event_type: 'call.state_changed',
              timestamp: '',
              data: { call_id: 'shared-call', state },
            })
          })

          expect(onCallSettled).toHaveBeenCalledWith('shared-call')
        }
      )

      it('says nothing while the call is still going', async () => {
        const onCallSettled = vi.fn()
        renderHook(() => useIncomingCall(mockAgentExtension, { onCallSettled }))

        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: { call_id: 'shared-call', state: 'ACTIVE' },
          })
        })

        expect(onCallSettled).not.toHaveBeenCalled()
      })

      it('says nothing when a colleague answers', async () => {
        const onCallSettled = vi.fn()
        const { result } = renderHook(() => useIncomingCall(mockAgentExtension, { onCallSettled }))
        await openPopup(result)

        // A colleague taking the call settles it for the queue, not for
        // whoever is now holding it — their window must survive.
        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: { call_id: 'shared-call', state: 'ACTIVE', answered_by: '2094' },
          })
        })

        expect(onCallSettled).not.toHaveBeenCalled()
      })

      it('says nothing when the event names no call', async () => {
        const onCallSettled = vi.fn()
        renderHook(() => useIncomingCall(mockAgentExtension, { onCallSettled }))

        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: { state: 'COMPLETED' },
          })
        })

        expect(onCallSettled).not.toHaveBeenCalled()
      })
    })

    // The contract is a bare extension. If the emitter ever sends a channel
    // instead, the operator holding the call must still be recognised as
    // themselves — anything else closes the window of the person on the call.
    // The suffixes are what make these realistic: a hex channel id on PJSIP, a
    // context and leg number on Local.
    const DECORATED = [
      ['a PJSIP channel', (ext: string) => `PJSIP/${ext}-0000001a`],
      ['a Local channel', (ext: string) => `Local/${ext}@from-queue-0001;2`],
      ['a bare tech prefix', (ext: string) => `SIP/${ext}`],
    ] as const

    describe.each(DECORATED)('when answered_by arrives as %s', (_label, decorate) => {
      it('keeps the window of the operator who answered', async () => {
        const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
        await openPopup(result)

        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: {
              call_id: 'shared-call',
              state: 'ACTIVE',
              answered_by: decorate(mockAgentExtension),
            },
          })
        })

        await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
      })

      it('still closes the window when a colleague answered', async () => {
        const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
        await openPopup(result)

        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: { call_id: 'shared-call', state: 'ACTIVE', answered_by: decorate('2094') },
          })
        })

        await waitFor(() => expect(result.current.incomingCall).toBeNull())
      })
    })

    it('leaves every window open when answered_by carries no extension', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'shared-call', state: 'ACTIVE', answered_by: 'unknown' },
        })
      })

      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('leaves every window open when answered_by names a trunk, not an operator', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: {
            call_id: 'shared-call',
            state: 'ACTIVE',
            answered_by: 'PJSIP/goip50056-line04-0000012a',
          },
        })
      })

      // A trunk is nobody's extension. Reading one as "a colleague answered"
      // would close every window on the queue at once.
      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('leaves every window open when answered_by is too long to be an extension', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: {
            call_id: 'shared-call',
            state: 'ACTIVE',
            answered_by: 'PJSIP/380442334455-00000001',
          },
        })
      })

      // A numerically named trunk parses as digits, so the token match alone
      // cannot reject it; the extension length the app enforces on users can.
      await waitFor(() => expect(result.current.hasIncomingCall).toBe(true))
    })

    it('says so when an answered call carries no usable answered_by', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'shared-call', state: 'RINGING', outcome: 'answered' },
        })
      })

      // An emitter that never sends the field is indistinguishable from a call
      // nobody answered, and both leave the window open. Only the log tells
      // them apart.
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining('answered_by'),
        expect.objectContaining({ call_id: 'shared-call' })
      )
      expect(result.current.hasIncomingCall).toBe(true)
    })

    it('says it once, not again when the same call reaches ACTIVE', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      // `outcome` stays 'answered' once set, so the answered branch is entered
      // again by the ACTIVE that follows.
      for (const state of ['RINGING', 'ACTIVE'] as const) {
        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: { call_id: 'shared-call', state, outcome: 'answered' },
          })
        })
      }

      expect(logged).toHaveBeenCalledTimes(1)
      expect(result.current.hasIncomingCall).toBe(true)
    })

    it('stays quiet about the operator’s own outbound calls', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      renderHook(() => useIncomingCall(mockAgentExtension))

      // This hook shares the agent room with useCallWebSocket, so it sees the
      // operator's outbound calls too. Those answer with no answering operator
      // by definition — the callee is a customer on a trunk, which does not
      // parse as an extension — so treating one as a broken contract would log
      // on every outbound call and bury the signal.
      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'an-outbound-call', state: 'ACTIVE', outcome: 'answered' },
        })
      })

      expect(logged).not.toHaveBeenCalled()
    })

    it('ignores a screen-pop for a call that already ended', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

      // A caller who gives up during ringing ends the call before the pop has
      // finished its client lookup. Opening a window here strands it exactly as
      // a late pop for a call a colleague took would.
      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: { call_id: 'shared-call', state: 'COMPLETED' },
        })
      })

      const incoming = mockSocket.on.mock.calls.find((c) => c[0] === 'call.incoming')?.[1]
      act(() => incoming(popup()))

      expect(result.current.hasIncomingCall).toBe(false)
    })

    it('still pops a call that ended long ago and is being offered afresh', async () => {
      vi.useFakeTimers()
      try {
        const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: { call_id: 'shared-call', state: 'COMPLETED' },
          })
        })

        act(() => {
          vi.advanceTimersByTime(60_000)
        })

        const incoming = mockSocket.on.mock.calls.find((c) => c[0] === 'call.incoming')?.[1]
        act(() => incoming(popup()))

        expect(result.current.hasIncomingCall).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('reads the answer signal regardless of how the outcome is cased', async () => {
      const { result } = renderHook(() => useIncomingCall(mockAgentExtension))
      await openPopup(result)

      // The call-service records outcomes as free strings; `state` is already
      // normalised, and this signal arrives earlier than `state` does.
      act(() => {
        stateHandler()({
          event_type: 'call.state_changed',
          timestamp: '',
          data: {
            call_id: 'shared-call',
            state: 'RINGING',
            outcome: 'ANSWERED',
            answered_by: '2094',
          },
        })
      })

      await waitFor(() => expect(result.current.incomingCall).toBeNull())
    })

    it('suppresses a late screen-pop only briefly, not for the rest of the session', async () => {
      vi.useFakeTimers()
      try {
        const { result } = renderHook(() => useIncomingCall(mockAgentExtension))

        act(() => {
          stateHandler()({
            event_type: 'call.state_changed',
            timestamp: '',
            data: { call_id: 'shared-call', state: 'ACTIVE', answered_by: '2094' },
          })
        })

        const incoming = mockSocket.on.mock.calls.find((c) => c[0] === 'call.incoming')?.[1]
        act(() => incoming(popup()))
        expect(result.current.hasIncomingCall).toBe(false)

        // Long enough that this can only be a fresh offer of the same id, not
        // the screen-pop that lost its race by a fraction of a second.
        act(() => {
          vi.advanceTimersByTime(60_000)
        })
        act(() => incoming(popup()))

        expect(result.current.hasIncomingCall).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
