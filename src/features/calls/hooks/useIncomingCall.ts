import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getAccessToken } from '@/lib/api'
import { CALL_STATE_CHANGED_EVENT } from '../types'
import { CallOutcome, CallState } from '../types'
import type { CallStateEvent, IncomingCallData, IncomingCallEvent } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8005'

/**
 * How many recently-taken calls to remember, so a screen-pop that arrives after
 * the call was already answered elsewhere is ignored rather than opening a
 * window nothing will ever close. A queue rings a handful of members and the
 * entries matter for seconds, so this only needs to outlive one burst.
 */
const TAKEN_CALL_MEMORY = 32

export function useIncomingCall(agentExtension: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const takenByOthersRef = useRef<Set<string>>(new Set())

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null)
  }, [])

  useEffect(() => {
    if (!agentExtension) {
      // Clean up socket if agent extension is removed
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    // Connect to WebSocket (reuse existing connection if available)
    if (!socketRef.current) {
      // The call-service Socket.IO handshake requires a JWT; without one the
      // server refuses the connection. Pass it via the auth payload (not the
      // query string) to keep the token out of URLs/access logs.
      const token = getAccessToken()
      if (!token) return

      const socket: Socket = io(WS_URL, {
        transports: ['websocket'],
        query: { agent_extension: agentExtension },
        auth: { token },
      })

      socketRef.current = socket

      // Join room for this agent's calls
      socket.on('connect', () => {
        socket.emit('join', { agent_extension: agentExtension })
      })
    }

    const socket = socketRef.current

    /**
     * Close the window only if the event is about the call it is showing.
     * An event with no `call_id` names no call, so it closes nothing — the same
     * bias as the rest of this handler, which never acts on an ambiguous event.
     */
    const dismissIfSameCall = (callId?: string) => {
      if (!callId) return
      setIncomingCall((current) => (current && current.call_id !== callId ? current : null))
    }

    // Listen for incoming call events
    const handleIncomingCall = (event: IncomingCallEvent) => {
      // The screen-pop carries enriched client data and so can be emitted after
      // the bare state event. If a colleague already took this call, opening a
      // window now would strand it: the events that would have closed it have
      // been and gone.
      if (takenByOthersRef.current.has(event.data?.call_id)) return
      setIncomingCall(event.data)
    }

    // Listen for call state changes to dismiss popup when call ends/rejected
    const handleCallStateChanged = (event: CallStateEvent) => {
      const state = event.data?.state?.toUpperCase()
      const callId = event.data?.call_id

      // Dismiss popup when call is completed, failed, or cancelled
      if (state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED') {
        dismissIfSameCall(callId)
        return
      }

      // A queue rings several operators at once. Once one of them answers, the
      // others are looking at a call they can no longer take — close it for
      // them, but leave it open for whoever actually took it.
      //
      // Both sides carry the bare extension: the payload is the call record's
      // `agent_extension`, and `agentExtension` is `authUser.asterisk_extension`.
      // A decorated form on either side would make the answering operator's own
      // window vanish instead, so this is a contract rather than a coincidence.
      // `state` only reaches ACTIVE on a later Newstate from the answering leg,
      // so waiting for it would leave everyone else's window open for the whole
      // conversation. The answer itself is visible earlier, on the outcome.
      const taken = state === CallState.ACTIVE || event.data?.outcome === CallOutcome.ANSWERED
      if (taken) {
        // Only `answered_by`, never `agent_extension`. The latter is the
        // record's current agent — the first-rung operator until the answering
        // leg is adopted — so falling back to it would close the window of
        // whoever is actually holding the call. Absent means the answerer is
        // unknown, and nobody's window should close on a guess.
        const answeredBy = event.data?.answered_by
        const someoneElseAnswered = typeof answeredBy === 'string' && answeredBy !== agentExtension
        if (someoneElseAnswered) {
          if (callId) {
            takenByOthersRef.current.add(callId)
            if (takenByOthersRef.current.size > TAKEN_CALL_MEMORY) {
              takenByOthersRef.current.delete(takenByOthersRef.current.values().next().value!)
            }
          }
          dismissIfSameCall(callId)
        }
      }
    }

    socket.on('call.incoming', handleIncomingCall)
    socket.on(CALL_STATE_CHANGED_EVENT, handleCallStateChanged)

    // Cleanup on unmount or when agent extension changes — disconnect so an
    // authenticated socket does not keep receiving call PII after the consumer
    // unmounts or the agent changes.
    return () => {
      socket.off('call.incoming', handleIncomingCall)
      socket.off(CALL_STATE_CHANGED_EVENT, handleCallStateChanged)
      socket.disconnect()
      socketRef.current = null
    }
  }, [agentExtension])

  return {
    incomingCall,
    hasIncomingCall: incomingCall !== null,
    dismissIncomingCall,
  }
}
