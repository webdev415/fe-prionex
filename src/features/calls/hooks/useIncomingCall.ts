import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getAccessToken } from '@/lib/api'
import { CALL_STATE_CHANGED_EVENT, CallOutcome, CallState } from '../types'
import type { CallStateEvent, IncomingCallData, IncomingCallEvent } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8005'

/**
 * How many recently-taken calls to remember, so a screen-pop that arrives after
 * the call was already answered elsewhere is ignored rather than opening a
 * window nothing will ever close.
 */
const TAKEN_CALL_MEMORY = 32

/**
 * How long that memory is allowed to suppress a screen-pop.
 *
 * It exists only to cover the screen-pop losing a race it should win by a
 * comfortable margin — the pop waits on a cross-service client lookup, the
 * state event does not. Without an expiry the entry outlives the call by hours,
 * and a call_id that is ever offered to this operator again is silently
 * swallowed. Bounded by count alone, a low-volume operator never evicts.
 */
const TAKEN_CALL_TTL_MS = 30_000

/**
 * The extension inside an identifier that may or may not be decorated.
 *
 * The wire contract is a bare extension, but a decorated form compared as-is
 * would read as "somebody else" and close the window of whoever is holding the
 * call. Take the extension token, not every digit: `PJSIP/2094-0000001a`
 * carries a hex channel suffix, and stripping non-digits would fold it into
 * `20940000001`, matching nobody. A value with no leading extension — a trunk
 * like `PJSIP/goip50056-line04`, or anything unparsed — yields null, which
 * callers treat as "we don't know who answered" and leave every window alone.
 */
const EXTENSION_PATTERN = /^(?:[A-Za-z0-9]+\/)?(\d+)/

function extensionOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return EXTENSION_PATTERN.exec(value)?.[1] ?? null
}

export function useIncomingCall(agentExtension: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const takenByOthersRef = useRef<Map<string, number>>(new Map())

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

    const rememberTakenByOther = (callId: string) => {
      const seen = takenByOthersRef.current
      const now = Date.now()
      for (const [id, at] of seen) {
        if (now - at > TAKEN_CALL_TTL_MS) seen.delete(id)
      }
      seen.set(callId, now)
      // Map iterates in insertion order, so the first key is the oldest.
      while (seen.size > TAKEN_CALL_MEMORY) {
        seen.delete(seen.keys().next().value!)
      }
    }

    const wasTakenByOther = (callId?: string) => {
      if (!callId) return false
      const at = takenByOthersRef.current.get(callId)
      if (at === undefined) return false
      if (Date.now() - at > TAKEN_CALL_TTL_MS) {
        takenByOthersRef.current.delete(callId)
        return false
      }
      return true
    }

    // Listen for incoming call events
    const handleIncomingCall = (event: IncomingCallEvent) => {
      // The screen-pop carries enriched client data and so can be emitted after
      // the bare state event. If a colleague already took this call, opening a
      // window now would strand it: the events that would have closed it have
      // been and gone.
      if (wasTakenByOther(event.data?.call_id)) return
      setIncomingCall(event.data)
    }

    // Listen for call state changes to dismiss popup when call ends/rejected
    const handleCallStateChanged = (event: CallStateEvent) => {
      const state = event.data?.state?.toUpperCase()
      const callId = event.data?.call_id

      // Dismiss popup when the call is over. 'CANCELLED' is not in `CallState`
      // and the backend cannot emit it; it is kept as a literal so a future
      // state by that name is still treated as terminal rather than ignored.
      if (state === CallState.COMPLETED || state === CallState.FAILED || state === 'CANCELLED') {
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
        const answeredBy = extensionOf(event.data?.answered_by)
        const mine = extensionOf(agentExtension)
        const someoneElseAnswered = answeredBy !== null && mine !== null && answeredBy !== mine
        if (someoneElseAnswered) {
          if (callId) rememberTakenByOther(callId)
          dismissIfSameCall(callId)
        } else if (answeredBy === null) {
          // Keeping every window open is the safe reading, but it is also what
          // an emitter that never sends the field looks like — identical, and
          // otherwise completely silent. This is the only thing that tells a
          // broken contract apart from an answerer we genuinely cannot name.
          console.error(
            '[useIncomingCall] call answered but answered_by is missing or unparseable; ' +
              'no window will close',
            { call_id: callId, answered_by: event.data?.answered_by }
          )
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
