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
// Call control. The phone runs off-screen, so its own answer button and
// auto-answer pill are unreachable — the operator acts here and we send it down.
export const MSG_ANSWER = 'crm-operator-phone/answer'
export const MSG_SET_AUTO_ANSWER = 'crm-operator-phone/set-auto-answer'

// Phone iframe -> parent (CRM)
export const MSG_READY_FOR_TOKEN = 'crm-operator-phone/ready-for-token'
export const MSG_STATUS = 'crm-operator-phone/status'
export const MSG_TOKEN_EXPIRED = 'crm-operator-phone/token-expired'
// The dialer announces a routed call on the phone's presence socket, not to us.
// Relayed up, this is the only way the CRM learns a call has arrived — there is
// no server-side event for it under the aggressive driver.
export const MSG_ROUTED_CALL = 'crm-operator-phone/routed-call'

export interface TokenMessage {
  type: typeof MSG_TOKEN
  token: string
}

export interface LogoutMessage {
  type: typeof MSG_LOGOUT
}

export interface AnswerMessage {
  type: typeof MSG_ANSWER
}

export interface SetAutoAnswerMessage {
  type: typeof MSG_SET_AUTO_ANSWER
  enabled: boolean
}

export type ParentToPhoneMessage =
  | TokenMessage
  | LogoutMessage
  | AnswerMessage
  | SetAutoAnswerMessage

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

/** Operator-modal context, relayed verbatim from the dialer's routed_call.incoming. */
export interface RoutedCallPayload {
  call_id: string
  client_id: number | null
  client_name: string | null
  phone: string | null
  campaign_id: number | null
}

export interface RoutedCallMessage {
  type: typeof MSG_ROUTED_CALL
  call: RoutedCallPayload
}

export type PhoneToParentMessage =
  | ReadyForTokenMessage
  | StatusMessage
  | TokenExpiredMessage
  | RoutedCallMessage

/** Narrow an untrusted postMessage payload to one of our phone->parent messages. */
export function parsePhoneMessage(data: unknown): PhoneToParentMessage | null {
  if (typeof data !== 'object' || data === null) return null
  const type = (data as { type?: unknown }).type
  if (type === MSG_READY_FOR_TOKEN) return { type: MSG_READY_FOR_TOKEN }
  if (type === MSG_TOKEN_EXPIRED) return { type: MSG_TOKEN_EXPIRED }
  if (type === MSG_ROUTED_CALL) {
    const call = (data as { call?: unknown }).call
    if (typeof call !== 'object' || call === null) return null
    const c = call as Record<string, unknown>
    // call_id keys the whole modal, so a payload without one is unusable.
    if (typeof c.call_id !== 'string' || !c.call_id) return null
    const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
    const num = (v: unknown) => (typeof v === 'number' ? v : null)
    return {
      type: MSG_ROUTED_CALL,
      call: {
        call_id: c.call_id,
        client_id: num(c.client_id),
        client_name: str(c.client_name),
        phone: str(c.phone),
        campaign_id: num(c.campaign_id),
      },
    }
  }
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
