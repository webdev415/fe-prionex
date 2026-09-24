import { type RefObject, useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { issuePhoneToken } from '../api/operatorPhoneService'
import { OPERATOR_PHONE_ORIGIN } from '../constants'
import {
  MSG_ANSWER,
  MSG_CALL_ANSWERED,
  MSG_CALL_ENDED,
  MSG_HANGUP,
  MSG_LOGOUT,
  MSG_READY_FOR_TOKEN,
  MSG_ROUTED_CALL,
  MSG_SET_AUTO_ANSWER,
  MSG_STATUS,
  MSG_TOKEN,
  MSG_TOKEN_EXPIRED,
  parsePhoneMessage,
  type ParentToPhoneMessage,
  type PhoneStatus,
  type RoutedCallPayload,
} from '../protocol'

export interface OperatorPhoneState {
  status: PhoneStatus
  aor: string | null
  /**
   * The call currently offered to this operator, relayed up by the phone. The
   * dialer publishes this only to the phone's presence socket, so it is the
   * CRM's sole notice that a call has arrived.
   */
  routedCall: RoutedCallPayload | null
  /**
   * The call the phone has confirmed is up. The CRM shows an active call on
   * this rather than on its own Accept having been sent: the message can be
   * dropped (iframe still loading, no live session) and an optimistic panel
   * would then be counting up on a call nobody answered.
   */
  answeredCallId: string | null
  /**
   * The call the phone has reported as over. The routed call is deliberately
   * NOT dropped on this: unmounting the active-call panel the moment the leg
   * drops would skip wrap-up and discard whatever the operator had typed into
   * the interaction form — on the most common way a call ends, the customer
   * hanging up first.
   */
  endedCallId: string | null
  /** Accept the offered call — sends the SIP answer via the phone. */
  answerCall: (callId: string) => void
  /** End the call from the CRM. The phone owns the SIP leg; nothing else can. */
  hangupCall: (callId: string) => void
  /** Drop the offered call locally once it is over or superseded. */
  clearRoutedCall: () => void
}

export interface OperatorPhoneOptions {
  /**
   * The operator's auto-connection preference. Declarative on purpose: it is
   * re-pushed whenever the phone reaches 'ready', so a CRM reload, an iframe
   * reload or a re-registration cannot leave the phone acting on a stale
   * setting while the CRM displays the current one.
   */
  autoAnswer?: boolean
}

interface PhoneCallState {
  /** The call on screen: an offer, a live call, or one awaiting wrap-up. */
  routedCall: RoutedCallPayload | null
  answeredCallId: string | null
  endedCallId: string | null
  /**
   * An offer that arrived while the previous call was still being wrapped up.
   * Held rather than applied: replacing the call outright unmounts the panel and
   * takes the operator's unsaved interaction note with it, which is the loss the
   * wrap-up handling exists to prevent. Promoted the moment wrap-up finishes,
   * which is bounded by the queue's wait time.
   */
  queuedCall: RoutedCallPayload | null
}

type PhoneCallAction =
  | { type: 'routed'; call: RoutedCallPayload }
  | { type: 'answered'; callId: string }
  | { type: 'ended'; callId: string }
  | { type: 'cleared' }

const initialCallState: PhoneCallState = {
  routedCall: null,
  answeredCallId: null,
  endedCallId: null,
  queuedCall: null,
}

/** True when the operator took this call and it is now over: wrap-up is due. */
function isWrappingUp(state: PhoneCallState): boolean {
  const id = state.routedCall?.call_id
  return id != null && state.answeredCallId === id && state.endedCallId === id
}

/**
 * One reducer rather than separate pieces of state: a new offer has to be
 * decided against what the current call has already done, which three
 * independent setters cannot express without reading each other.
 */
function callReducer(state: PhoneCallState, action: PhoneCallAction): PhoneCallState {
  switch (action.type) {
    case 'routed':
      // Only a call the operator actually took is worth protecting; an offer
      // that was never answered is simply replaced.
      if (isWrappingUp(state)) return { ...state, queuedCall: action.call }
      return {
        routedCall: action.call,
        answeredCallId: null,
        endedCallId: null,
        queuedCall: null,
      }
    case 'answered':
      return { ...state, answeredCallId: action.callId }
    case 'ended':
      return { ...state, endedCallId: action.callId }
    case 'cleared':
      if (state.queuedCall) {
        return {
          routedCall: state.queuedCall,
          answeredCallId: null,
          endedCallId: null,
          queuedCall: null,
        }
      }
      return initialCallState
  }
}

// Bounded retry for a transient mint failure (the token endpoint is a POST, which
// the shared axios layer deliberately does not auto-retry). Without this a single
// 503/timeout at handshake would strand the phone offline until a remount.
const MINT_MAX_ATTEMPTS = 3
const MINT_RETRY_BASE_MS = 1000

/**
 * Drives the hidden WebRTC phone iframe (KAN-353, phases 1–2):
 *
 * 1. the iframe announces `ready-for-token` once it has loaded;
 * 2. we mint a phone JWT from the CRM (`issuePhoneToken`) and post it in — the
 *    token never touches a URL;
 * 3. the phone reports Offline/Connecting/Ready back over postMessage, which we
 *    surface for the status indicator;
 * 4. on `token-expired` we re-mint (a safety net; the phone also self-refreshes).
 *
 * Every message is checked against the phone's exact origin AND source frame.
 */
export function useOperatorPhone(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  options: OperatorPhoneOptions = {}
): OperatorPhoneState {
  const { autoAnswer = false } = options
  const [status, setStatus] = useState<PhoneStatus>('offline')
  const [aor, setAor] = useState<string | null>(null)
  const [call, dispatchCall] = useReducer(callReducer, initialCallState)
  const { routedCall, answeredCallId, endedCallId } = call
  const mintingRef = useRef(false)

  const postToPhone = useCallback(
    (message: ParentToPhoneMessage) => {
      // No configured origin (a deployed build without VITE_OPERATOR_PHONE_URL):
      // there is no phone to talk to, and postMessage rejects an empty
      // targetOrigin outright. The inbound handler fails closed on the same
      // check, so the phone is simply inert rather than half-wired.
      if (!OPERATOR_PHONE_ORIGIN) return
      iframeRef.current?.contentWindow?.postMessage(message, OPERATOR_PHONE_ORIGIN)
    },
    [iframeRef]
  )

  const mintAndSend = useCallback(async () => {
    if (mintingRef.current) return
    mintingRef.current = true
    // Optimistic: we're acquiring a token and the phone will register shortly.
    setStatus((current) => (current === 'ready' ? current : 'connecting'))
    try {
      for (let attempt = 1; attempt <= MINT_MAX_ATTEMPTS; attempt++) {
        try {
          const { access_token, aor: mintedAor } = await issuePhoneToken()
          setAor(mintedAor)
          postToPhone({ type: MSG_TOKEN, token: access_token })
          return
        } catch (err) {
          if (attempt === MINT_MAX_ATTEMPTS) throw err
          await new Promise((resolve) => setTimeout(resolve, MINT_RETRY_BASE_MS * attempt))
        }
      }
    } catch {
      setStatus('error')
      setAor(null)
    } finally {
      mintingRef.current = false
    }
  }, [postToPhone])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Trust only the configured phone origin AND the actual iframe window —
      // origin alone would let any same-origin frame/popup spoof status.
      if (event.origin !== OPERATOR_PHONE_ORIGIN) return
      if (event.source !== iframeRef.current?.contentWindow) return
      const message = parsePhoneMessage(event.data)
      if (!message) return
      switch (message.type) {
        case MSG_READY_FOR_TOKEN:
        case MSG_TOKEN_EXPIRED:
          void mintAndSend()
          break
        case MSG_ROUTED_CALL:
          dispatchCall({ type: 'routed', call: message.call })
          break
        case MSG_CALL_ANSWERED:
          dispatchCall({ type: 'answered', callId: message.call_id })
          break
        case MSG_CALL_ENDED:
          // Recorded, not acted on: the view keeps the call on screen for
          // wrap-up and clears it when the operator is done. A late 'ended' for
          // a superseded call is filtered by the id comparison there.
          dispatchCall({ type: 'ended', callId: message.call_id })
          break
        case MSG_STATUS:
          setStatus(message.status)
          // Keep the AOR only while connected; drop it once offline/errored so
          // the pill never shows a stale "Offline · operator-…".
          if (message.aor) setAor(message.aor)
          else if (message.status === 'offline' || message.status === 'error') setAor(null)
          break
      }
    }
    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
      // Best-effort: tell the phone to drop its session as the operator leaves.
      postToPhone({ type: MSG_LOGOUT })
    }
  }, [mintAndSend, postToPhone, iframeRef])

  const answerCall = useCallback(
    (callId: string) => {
      postToPhone({ type: MSG_ANSWER, call_id: callId })
    },
    [postToPhone]
  )

  const hangupCall = useCallback(
    (callId: string) => {
      postToPhone({ type: MSG_HANGUP, call_id: callId })
    },
    [postToPhone]
  )

  // Re-established on every transition into 'ready', not only when the operator
  // flips the toggle — that is what makes the preference survive a reload on
  // either side of the frame.
  useEffect(() => {
    if (status !== 'ready') return
    postToPhone({ type: MSG_SET_AUTO_ANSWER, enabled: autoAnswer })
  }, [autoAnswer, status, postToPhone])

  const clearRoutedCall = useCallback(() => dispatchCall({ type: 'cleared' }), [])

  return {
    status,
    aor,
    routedCall,
    answeredCallId,
    endedCallId,
    answerCall,
    hangupCall,
    clearRoutedCall,
  }
}
