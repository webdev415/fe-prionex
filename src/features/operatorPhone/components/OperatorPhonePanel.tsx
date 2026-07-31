import { useRef } from 'react'

import { OPERATOR_PHONE_URL } from '../constants'
import { useOperatorPhone } from '../hooks/useOperatorPhone'
import { OperatorPhoneStatus } from './OperatorPhoneStatus'

/**
 * The operator phone as a hidden background tab plus its status pill (KAN-353).
 *
 * The iframe is kept mounted (so the SIP session and audio persist) but moved
 * fully off-screen — deliberately NOT `display:none`, which can suspend media in
 * some browsers. `allow="microphone"` grants the cross-origin phone mic access.
 */
export function OperatorPhonePanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { status, aor } = useOperatorPhone(iframeRef)

  return (
    <>
      <iframe
        ref={iframeRef}
        src={OPERATOR_PHONE_URL}
        title="Operator phone"
        aria-hidden
        allow="microphone"
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
