import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

import { issuePhoneToken } from '../api/operatorPhoneService'
import { OPERATOR_PHONE_ORIGIN } from '../constants'
import {
  MSG_ANSWER,
  MSG_LOGOUT,
  MSG_READY_FOR_TOKEN,
  MSG_ROUTED_CALL,
  MSG_SET_AUTO_ANSWER,
  MSG_STATUS,
  MSG_TOKEN,
  MSG_TOKEN_EXPIRED,
  parsePhoneMessage,
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
  /** Accept the offered call — sends the SIP answer via the phone. */
  answerCall: () => void
  /** Push the operator's auto-answer preference down to the phone. */
  setAutoAnswer: (enabled: boolean) => void
  /** Drop the offered call locally once it is over or superseded. */
  clearRoutedCall: () => void
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
  iframeRef: RefObject<HTMLIFrameElement | null>
): OperatorPhoneState {
  const [status, setStatus] = useState<PhoneStatus>('offline')
  const [aor, setAor] = useState<string | null>(null)
  const [routedCall, setRoutedCall] = useState<RoutedCallPayload | null>(null)
  const mintingRef = useRef(false)

  const postToPhone = useCallback(
    (message: object) => {
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
          setRoutedCall(message.call)
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

  const answerCall = useCallback(() => {
    postToPhone({ type: MSG_ANSWER })
  }, [postToPhone])

  const setAutoAnswer = useCallback(
    (enabled: boolean) => {
      postToPhone({ type: MSG_SET_AUTO_ANSWER, enabled })
    },
    [postToPhone]
  )

  const clearRoutedCall = useCallback(() => setRoutedCall(null), [])

  return { status, aor, routedCall, answerCall, setAutoAnswer, clearRoutedCall }
}
