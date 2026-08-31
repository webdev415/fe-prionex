import { useRef } from 'react'

import { OPERATOR_PHONE_CONFIGURED, OPERATOR_PHONE_URL } from '../constants'
import { useOperatorPhone } from '../hooks/useOperatorPhone'
import { OperatorPhoneStatus } from './OperatorPhoneStatus'

/**
 * The operator phone as a hidden background tab plus its status pill (KAN-353).
 *
 * The iframe is kept mounted (so the SIP session and audio persist) but moved
 * fully off-screen — deliberately NOT `display:none`, which can suspend media in
 * some browsers. `allow="microphone; autoplay"` grants the cross-origin phone
 * mic access AND lets it play call/ringtone audio without a user gesture inside
 * the frame (autoplay is not delegated to cross-origin iframes by default). The
 * CRM top page must also delegate these features via Permissions-Policy.
 *
 * Renders nothing when no phone origin is configured (a deployed build without
 * VITE_OPERATOR_PHONE_URL). Framing a guessed origin would be worse than
 * absent: the hook posts the operator's phone JWT to it.
 */
export function OperatorPhonePanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { status, aor } = useOperatorPhone(iframeRef)

  if (!OPERATOR_PHONE_CONFIGURED) return null

  return (
    <>
      <iframe
        ref={iframeRef}
        src={OPERATOR_PHONE_URL}
        title="Operator phone"
        aria-hidden
        allow="microphone; autoplay"
        style={{
          position: 'fixed',
          width: 1,
          height: 1,
          border: 0,
          left: -9999,
          top: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      <OperatorPhoneStatus status={status} aor={aor} />
    </>
  )
}
