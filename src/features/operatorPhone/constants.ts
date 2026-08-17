// Where the hidden WebRTC phone is served (KAN-353). Its own origin — the CRM
// embeds it as a background iframe and exchanges the JWT via postMessage.
// Defaults to the phone's Vite dev server; set VITE_OPERATOR_PHONE_URL in prod
// (e.g. https://phone.crm-prionex.online).
const DEFAULT_PHONE_URL = 'http://localhost:5173'

// Treat an empty string as unset (an empty env var must not blank the URL and
// then crash `new URL('')` below).
const configured = import.meta.env.VITE_OPERATOR_PHONE_URL
const resolved = typeof configured === 'string' && configured.trim() !== '' ? configured : null

// 🔴 The localhost default is a DEVELOPMENT convenience and must never reach a
// production bundle.
//
// `VITE_OPERATOR_PHONE_URL` was outside the Dockerfile's build-arg contract, so
// every image built by CI had it undefined and fell back to this constant. That
// put `http://localhost:5173` into the preprod bundle as the origin this app
// hands its JWT to (`postMessage` below) — verified by extracting the shipped
// layer, not inferred. On an operator's machine that origin is their OWN
// machine, and Vite's default port is exactly 5173, so a developer running
// `npm run dev` while logged into preprod would have had the CRM post a live
// token into their local server.
//
// Gating on `import.meta.env.PROD` rather than on the variable's presence is
// deliberate: `npm run dev` and the test suite keep the convenience, and a
// production build gets null instead of somewhere wrong. Silence is not an
// option either way — the panel is simply not rendered when this is null.
export const OPERATOR_PHONE_URL: string | null =
  resolved ?? (import.meta.env.PROD ? null : DEFAULT_PHONE_URL)

/** False when no phone service is configured for this environment. */
export const OPERATOR_PHONE_ENABLED = OPERATOR_PHONE_URL !== null

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

// Empty string when disabled: nothing is ever posted to it, because the panel
// does not mount. Kept as a string so every consumer's type stays unchanged.
export const OPERATOR_PHONE_ORIGIN =
  OPERATOR_PHONE_URL === null ? '' : deriveOrigin(OPERATOR_PHONE_URL)
