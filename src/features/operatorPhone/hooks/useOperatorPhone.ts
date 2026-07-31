import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

import { issuePhoneToken } from '../api/operatorPhoneService'
import { OPERATOR_PHONE_ORIGIN } from '../constants'
import {
  MSG_LOGOUT,
  MSG_READY_FOR_TOKEN,
  MSG_STATUS,
  MSG_TOKEN,
  MSG_TOKEN_EXPIRED,
  parsePhoneMessage,
  type PhoneStatus,
} from '../protocol'

export interface OperatorPhoneState {
  status: PhoneStatus
  aor: string | null
}

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
 * Every message is origin-checked against the phone's exact origin.
 */
export function useOperatorPhone(
  iframeRef: RefObject<HTMLIFrameElement | null>
): OperatorPhoneState {
  const [status, setStatus] = useState<PhoneStatus>('offline')
  const [aor, setAor] = useState<string | null>(null)
  const mintingRef = useRef(false)

  const postToPhone = useCallback(
    (message: object) => {
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
      const { access_token, aor: mintedAor } = await issuePhoneToken()
      setAor(mintedAor)
      postToPhone({ type: MSG_TOKEN, token: access_token })
    } catch {
      setStatus('error')
    } finally {
      mintingRef.current = false
    }
  }, [postToPhone])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== OPERATOR_PHONE_ORIGIN) return
      const message = parsePhoneMessage(event.data)
      if (!message) return
      switch (message.type) {
        case MSG_READY_FOR_TOKEN:
        case MSG_TOKEN_EXPIRED:
          void mintAndSend()
          break
        case MSG_STATUS:
          setStatus(message.status)
          if (message.aor) setAor(message.aor)
          break
      }
    }
    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
      // Best-effort: tell the phone to drop its session as the operator leaves.
      postToPhone({ type: MSG_LOGOUT })
    }
  }, [mintAndSend, postToPhone])

  return { status, aor }
}
