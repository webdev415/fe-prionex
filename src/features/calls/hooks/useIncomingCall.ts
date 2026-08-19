import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getAccessToken } from '@/lib/api'
import { CALL_STATE_CHANGED_EVENT, CallOutcome, CallState } from '../types'
import type { CallStateEvent, IncomingCallData, IncomingCallEvent } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8005'

/**
 * How many recently-settled calls to remember, so a screen-pop that arrives
 * after the call was already answered elsewhere or already over is ignored
 * rather than opening a window nothing will ever close.
 */
const SETTLED_CALL_MEMORY = 32

/**
 * How long that memory is allowed to suppress a screen-pop.
 *
 * It exists only to cover the screen-pop losing a race it should win by a
 * comfortable margin — the pop waits on a cross-service client lookup, the
 * state event does not. Without an expiry the entry outlives the call by hours,
 * and a call_id that is ever offered to this operator again is silently
 * swallowed. Bounded by count alone, a low-volume operator never evicts.
 */
const SETTLED_CALL_TTL_MS = 30_000

/**
 * The extension inside an identifier that may or may not be decorated.
 *
 * The wire contract is a bare extension, but a decorated form compared as-is
 * would read as "somebody else" and close the window of whoever is holding the
 * call. Take the extension token, not every digit: `PJSIP/2094-0000001a`
 * carries a hex channel suffix, and stripping non-digits would fold it into
 * `20940000001`, matching nobody.
 *
 * Anything that is not shaped like an extension yields null, and callers treat
 * that as "we don't know who answered" and leave every window alone — the safe
 * direction, since the alternative closes every window on the queue at once.
 * That covers a trunk named like `PJSIP/goip50056-line04` and a full number,
 * but NOT a trunk named as a short digit run; nothing on this side can tell one
 * of those from an operator.
 */
const EXTENSION_PATTERN = /^(?:[A-Za-z0-9]+\/)?(\d+)/

// Matches the extension the app itself enforces on users (userSchemas.ts).
const EXTENSION_LENGTH = { min: 3, max: 10 }

function extensionOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const extension = EXTENSION_PATTERN.exec(value)?.[1]
  if (!extension) return null
  return extension.length >= EXTENSION_LENGTH.min && extension.length <= EXTENSION_LENGTH.max
    ? extension
    : null
}

export interface UseIncomingCallOptions {
  /**
   * A call this operator can see has reached a terminal state.
   *
   * The socket carries state for every call in the agent's room, which makes
   * this the one place that learns a call is over without waiting for a poll to
   * notice. Consumers holding their own call window use it to settle that
   * window; the callee is responsible for checking the id names *their* call.
   *
   * `totalDuration` is passed on because it is the last chance to get it: a
   * window told the call is over stops polling, so nothing else will ever
   * supply the final talk time.
   */
  onCallSettled?: (
    callId: string,
    settled: { state: 'ended' | 'failed'; totalDuration?: number }
  ) => void
}

export function useIncomingCall(
  agentExtension: string | null,
  { onCallSettled }: UseIncomingCallOptions = {}
) {
  const socketRef = useRef<Socket | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  // When this operator took the call, as a timestamp so a consumer can run the
  // conversation clock. Null while it is only ringing.
  const [answeredAt, setAnsweredAt] = useState<number | null>(null)
  // The call is over but the window stays: see the terminal branch below.
  const [callEnded, setCallEnded] = useState(false)
  // The state handler is registered once per connection, so it cannot read
  // `answeredAt` directly without closing over the first render's value.
  const answeredRef = useRef(false)
  // Held in a ref so a caller passing an inline function does not tear down and
  // rebuild the socket on every render.
  const onCallSettledRef = useRef(onCallSettled)
  const settledCallsRef = useRef<Map<string, number>>(new Map())
  const shownCallRef = useRef<string | null>(null)
  const loggedMissingAnswererRef = useRef<string | null>(null)

  // The state handler is registered once per connection and would otherwise
  // close over the first render's value.
  useEffect(() => {
    shownCallRef.current = incomingCall?.call_id ?? null
  }, [incomingCall])

  useEffect(() => {
    answeredRef.current = answeredAt !== null
  }, [answeredAt])

  useEffect(() => {
    onCallSettledRef.current = onCallSettled
  })

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null)
    setAnsweredAt(null)
    setCallEnded(false)
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

    /**
     * Record that this call is over for this operator — answered by a colleague
     * or ended outright. Either way a screen-pop for it is stale on arrival.
     */
    const rememberSettled = (callId?: string) => {
      if (!callId) return
      const seen = settledCallsRef.current
      const now = Date.now()
      for (const [id, at] of seen) {
        if (now - at > SETTLED_CALL_TTL_MS) seen.delete(id)
      }
      seen.set(callId, now)
      // Map iterates in insertion order, so the first key is the oldest.
      while (seen.size > SETTLED_CALL_MEMORY) {
        seen.delete(seen.keys().next().value!)
      }
    }

    const wasSettled = (callId?: string) => {
      if (!callId) return false
      const at = settledCallsRef.current.get(callId)
      if (at === undefined) return false
      if (Date.now() - at > SETTLED_CALL_TTL_MS) {
        settledCallsRef.current.delete(callId)
        return false
      }
      return true
    }

    // Listen for incoming call events
    const handleIncomingCall = (event: IncomingCallEvent) => {
      // The screen-pop carries enriched client data and so can be emitted after
      // the bare state event. If this call is already settled, opening a window
      // now would strand it: the events that would have closed it have been and
      // gone.
      if (wasSettled(event.data?.call_id)) return
      // A fresh offer starts unanswered and unfinished, even if the last one
      // was taken and ended.
      setAnsweredAt(null)
      setCallEnded(false)
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
        // Remembered for the same reason an answer is: a caller who gives up
        // during ringing ends the call before the screen-pop has finished its
        // client lookup, and the pop then opens a window for a call that is
        // already over with nothing left to close it.
        rememberSettled(callId)
        // A call this operator was connected to leaves an interaction half
        // written; the window has to survive the hangup or that work is gone,
        // and there is no way back to it — the form only exists here. A call
        // that merely rang has nothing to keep, so it still goes.
        if (callId && shownCallRef.current === callId && answeredRef.current) {
          setCallEnded(true)
        } else {
          dismissIfSameCall(callId)
        }
        // Deliberately not fired for a colleague answering: that settles the
        // call for the queue, not for whoever is now holding it.
        if (callId) {
          onCallSettledRef.current?.(callId, {
            // Only FAILED is a failure. A caller who hangs up mid-ring arrives
            // as COMPLETED, and so does 'CANCELLED' — neither is an error to
            // put in front of the operator in red.
            state: state === CallState.FAILED ? 'failed' : 'ended',
            totalDuration: event.data?.total_duration,
          })
        }
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
      // Normalised for the same reason `state` is: the call-service records
      // outcomes as free-form strings, and this one is the earlier and more
      // load-bearing of the two signals.
      const outcome = event.data?.outcome?.toLowerCase()
      const taken = state === CallState.ACTIVE || outcome === CallOutcome.ANSWERED
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
          rememberSettled(callId)
          dismissIfSameCall(callId)
        } else if (answeredBy !== null && mine !== null && answeredBy === mine) {
          // Named as the answerer, so this operator is holding the call. Only
          // an explicit match counts: a missing answered_by could equally mean
          // a colleague took it, and showing this operator a connected window
          // would invite them to file an interaction for a conversation
          // somebody else is having.
          if (callId && shownCallRef.current === callId) {
            setAnsweredAt((current) => current ?? Date.now())
          }
        } else if (
          answeredBy === null &&
          callId &&
          // Only calls this operator is actually looking at. The socket joins
          // the agent's own room, so this handler also sees the operator's
          // outbound calls — which answer with no answering operator by
          // definition, and would otherwise log on every one of them and bury
          // the signal this exists to give. Scoped to the open window, it fires
          // only where a missing answerer has a consequence: the window that
          // should have closed and did not.
          shownCallRef.current === callId &&
          // `outcome` stays 'answered' through the later ACTIVE, so the same
          // call reports twice.
          loggedMissingAnswererRef.current !== callId
        ) {
          loggedMissingAnswererRef.current = callId
          // Keeping the window open is the safe reading, but it is also what an
          // emitter that never sends the field looks like — identical, and
          // otherwise completely silent. This is the only thing that tells a
          // broken contract apart from an answerer we genuinely cannot name.
          console.error(
            '[useIncomingCall] call answered but answered_by is missing or unparseable; ' +
              'the window will stay open',
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
    answeredAt,
    /** The call is over, but the operator has not finished with the window. */
    callEnded,
    /** For the operator who presses Accept: the answer is known locally first. */
    markAnswered: () => setAnsweredAt((current) => current ?? Date.now()),
    dismissIncomingCall,
  }
}
