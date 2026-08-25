// Where the hidden WebRTC phone is served (KAN-353). Its own origin — the CRM
// embeds it as a background iframe and exchanges the JWT via postMessage.
// Deployed builds are served from https://webrtc.crm-prionex.online; set
// VITE_OPERATOR_PHONE_URL at BUILD time (Vite inlines it, so a runtime .env on
// the server has no effect).
//
// The localhost default is DEV-ONLY, deliberately. `useOperatorPhone` posts the
// operator's phone JWT to this origin, so a deployed bundle that fell back to a
// local origin would hand that token to whatever happens to be listening on
// that port on the operator's machine. With the variable unset outside dev the
// phone stays unconfigured and the panel does not mount at all.
const DEFAULT_PHONE_URL = import.meta.env.DEV ? 'http://localhost:5173' : ''

// Treat an empty string as unset (an empty env var must not blank the URL and
// then crash `new URL('')` below).
const configured = import.meta.env.VITE_OPERATOR_PHONE_URL
export const OPERATOR_PHONE_URL =
  typeof configured === 'string' && configured.trim() !== '' ? configured : DEFAULT_PHONE_URL

// The exact origin we accept messages from / post the token to. Deriving it once
// keeps every origin check consistent and avoids trusting a wildcard. An unset
// or unparseable URL yields "" — never a guessed origin — which fails every
// origin comparison closed and suppresses the panel.
function deriveOrigin(url: string): string {
  if (!url) return ''
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

export const OPERATOR_PHONE_ORIGIN = deriveOrigin(OPERATOR_PHONE_URL)

/** False when no usable phone origin is configured — the panel must not mount. */
export const OPERATOR_PHONE_CONFIGURED = OPERATOR_PHONE_ORIGIN !== ''
