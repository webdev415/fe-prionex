// Where the hidden WebRTC phone is served (KAN-353). Its own origin — the CRM
// embeds it as a background iframe and exchanges the JWT via postMessage.
// Defaults to the phone's Vite dev server; set VITE_OPERATOR_PHONE_URL in prod
// (e.g. https://phone.crm-prionex.online).
export const OPERATOR_PHONE_URL =
  import.meta.env.VITE_OPERATOR_PHONE_URL !== undefined
    ? import.meta.env.VITE_OPERATOR_PHONE_URL
    : 'http://localhost:5173'

// The exact origin we accept messages from / post the token to. Deriving it once
// keeps every origin check consistent and avoids trusting a wildcard.
export const OPERATOR_PHONE_ORIGIN = new URL(OPERATOR_PHONE_URL).origin
