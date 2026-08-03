// postMessage contract between the CRM (parent) and the hidden WebRTC phone
// iframe (KAN-353). The counterpart lives in the phone repo (WebRTC/).
//
// The token is delivered here, in a same-origin-checked postMessage body — never
// in a URL, per the ticket's key requirement. Status flows back the same way so
// the CRM can render the Offline / Connecting / Ready indicator while the phone
// runs as a background tab.

/** Phase 1–2 status set. Call-flow states (ringing/in_call) arrive next week. */
export type PhoneStatus = 'offline' | 'connecting' | 'ready' | 'error'

export const PHONE_STATUSES: readonly PhoneStatus[] = ['offline', 'connecting', 'ready', 'error']

// Parent (CRM) -> phone iframe
export const MSG_TOKEN = 'crm-operator-phone/token'
export const MSG_LOGOUT = 'crm-operator-phone/logout'

// Phone iframe -> parent (CRM)
export const MSG_READY_FOR_TOKEN = 'crm-operator-phone/ready-for-token'
export const MSG_STATUS = 'crm-operator-phone/status'
export const MSG_TOKEN_EXPIRED = 'crm-operator-phone/token-expired'

export interface TokenMessage {
  type: typeof MSG_TOKEN
  token: string
}

export interface LogoutMessage {
  type: typeof MSG_LOGOUT
}

export type ParentToPhoneMessage = TokenMessage | LogoutMessage

export interface ReadyForTokenMessage {
  type: typeof MSG_READY_FOR_TOKEN
}

export interface StatusMessage {
  type: typeof MSG_STATUS
  status: PhoneStatus
  aor?: string
}

export interface TokenExpiredMessage {
  type: typeof MSG_TOKEN_EXPIRED
}

export type PhoneToParentMessage = ReadyForTokenMessage | StatusMessage | TokenExpiredMessage

/** Narrow an untrusted postMessage payload to one of our phone->parent messages. */
export function parsePhoneMessage(data: unknown): PhoneToParentMessage | null {
  if (typeof data !== 'object' || data === null) return null
  const type = (data as { type?: unknown }).type
  if (type === MSG_READY_FOR_TOKEN) return { type: MSG_READY_FOR_TOKEN }
  if (type === MSG_TOKEN_EXPIRED) return { type: MSG_TOKEN_EXPIRED }
  if (type === MSG_STATUS) {
    const status = (data as { status?: unknown }).status
    if (typeof status !== 'string' || !PHONE_STATUSES.includes(status as PhoneStatus)) {
      return null
    }
    const aor = (data as { aor?: unknown }).aor
    return {
      type: MSG_STATUS,
      status: status as PhoneStatus,
      aor: typeof aor === 'string' ? aor : undefined,
    }
  }
  return null
}
