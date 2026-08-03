// Where the hidden WebRTC phone is served (KAN-353). Its own origin — the CRM
// embeds it as a background iframe and exchanges the JWT via postMessage.
// Defaults to the phone's Vite dev server; set VITE_OPERATOR_PHONE_URL in prod
// (e.g. https://phone.crm-prionex.online).
const DEFAULT_PHONE_URL = 'http://localhost:5173'

// Treat an empty string as unset (an empty env var must not blank the URL and
// then crash `new URL('')` below).
const configured = import.meta.env.VITE_OPERATOR_PHONE_URL
export const OPERATOR_PHONE_URL =
  typeof configured === 'string' && configured.trim() !== '' ? configured : DEFAULT_PHONE_URL

// The exact origin we accept messages from / post the token to. Deriving it once
// keeps every origin check consistent and avoids trusting a wildcard. A
// misconfigured (unparseable) URL must not crash the whole app at import time,
// so fall back to the default origin.
function deriveOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return new URL(DEFAULT_PHONE_URL).origin
  }
}

export const OPERATOR_PHONE_ORIGIN = deriveOrigin(OPERATOR_PHONE_URL)
