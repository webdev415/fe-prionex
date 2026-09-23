import type { RefObject } from 'react'

import { OPERATOR_PHONE_CONFIGURED, OPERATOR_PHONE_URL } from '../constants'
import type { PhoneStatus } from '../protocol'
import { OperatorPhoneStatus } from './OperatorPhoneStatus'
import { piiProps } from '@/lib/openreplay/pii'

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
 * absent: the operator's phone JWT is posted to that origin.
 *
 * Presentational: `useOperatorPhone` is owned by the operator view, because the
 * call control it exposes (answer, auto-answer, the routed call itself) drives
 * the view's own surfaces, not this hidden frame.
 */
export interface OperatorPhonePanelProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  status: PhoneStatus
  aor: string | null
}

export function OperatorPhonePanel({ iframeRef, status, aor }: OperatorPhonePanelProps) {
  if (!OPERATOR_PHONE_CONFIGURED) return null

  return (
    <>
      {/* Cross-origin today, so the tracker cannot reach its DOM anyway. Marked
          by the same rule regardless: the decision must not depend on whether
          the origins happen to match this week. */}
      <iframe
        ref={iframeRef}
        src={OPERATOR_PHONE_URL}
        title="Operator phone"
        aria-hidden
        {...piiProps}
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
