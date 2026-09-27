/**
 * Client e-mail channel of email-service — the doors the client card reads.
 *
 * ⚠️ Written by hand from the door contract (`/api/v1/email/*` of email-service,
 * schemas `services/email/app/schemas/client_email.py`), not generated. TypeScript
 * does not check JSON at run time: a field spelled differently here renders as a
 * silent blank rather than an error, so every name below has to be compared with
 * a live answer before it is trusted. The assertions at the bottom pin the
 * fields and values the screen branches on — a rename turns the build red with
 * the assertion's name instead of quietly drawing the wrong state.
 */

/**
 * State of the project mailbox as the server sees it.
 *
 * Only `connected` lets the operator read and write; every other value is the
 * «not connected» notice. `null` comes with `enabled: false` — the channel is off.
 */
export type ProjectMailboxState = 'connected' | 'error' | 'disabled' | 'not_configured'

/**
 * `GET /api/v1/email/capabilities` — the one switch the card reads.
 *
 * The front-end has no build flag of its own: the server answers this door in
 * every build that has the channel, with `enabled: false` while its flag is off,
 * and an older build answers `404`. The API client folds that `404` into
 * `CLIENT_EMAIL_DISABLED`, so a card talking to an older api simply has no
 * «Пошта» sub-tab.
 */
export interface ClientEmailCapabilities {
  enabled: boolean
  project_mailbox: ProjectMailboxState | null
  /** Rights of the caller's token — the server decides, the card only mirrors. */
  can_read: boolean
  can_send: boolean
}

/** What the card shows when the channel is off or the api does not know the door. */
export const CLIENT_EMAIL_DISABLED: ClientEmailCapabilities = Object.freeze({
  enabled: false,
  project_mailbox: null,
  can_read: false,
  can_send: false,
})

export type ClientEmailDirection = 'incoming' | 'outbound'

/** `system` — a letter from the project's `noreply@` sender, not from an operator. */
export type ClientEmailChannel = 'project' | 'system'

/** How the letter was tied to this client (server rule, shown for diagnostics only). */
export type ClientEmailLinkSource =
  | 'sent_to_client'
  | 'thread_reply'
  | 'sender_email'
  | 'recipient_email'
  | 'system'

/** One row of `GET /api/v1/email/clients/{client_id}/messages`. */
export interface ClientEmailMessage {
  /** uuid of the letter. */
  id: string
  thread_id: string
  direction: ClientEmailDirection
  channel: ClientEmailChannel
  subject: string | null
  /** The other side's address: the sender of an incoming letter, the recipient of ours. */
  counterparty: string | null
  /** Our mailbox the letter went through; `null` for a system letter. */
  mailbox_email: string | null
  /** `sent_at` of an outbound letter, `received_at` of an incoming one (ISO, UTC). */
  at: string
  attachment_count: number
  link_source: ClientEmailLinkSource | null
}

/**
 * The list envelope. Rows arrive already ordered (`at DESC, id DESC`); the card
 * keeps that order — re-sorting on the client would disagree with `total` and the
 * next page. Outbound letters that have not left yet are not in `items` nor in
 * `total`: the server shows only what was actually sent.
 */
export interface ClientEmailMessageList {
  items: ClientEmailMessage[]
  total: number
  limit: number
  offset: number
}

export interface ClientEmailAttachment {
  filename: string
  content_type: string
  size: number
}

/**
 * `GET /api/v1/email/clients/{client_id}/messages/{message_id}`.
 *
 * Text only, by design of the door: `body_html` is never sent (its inline images
 * point at the lawyers' doors, which are closed to the channel). A letter that had
 * only HTML arrives as text the server derived from it, with
 * `body_derived_from_html: true`. A quarantined letter has `body_text: null`.
 */
export interface ClientEmailMessageDetail extends ClientEmailMessage {
  body_text: string | null
  body_derived_from_html?: boolean
  is_quarantined: boolean
  attachments: ClientEmailAttachment[]
}

/**
 * Body of `POST /api/v1/email/clients/{client_id}/messages`.
 *
 * `to_address` is deliberately absent: the server always writes to the address
 * of the client's card, and a front-end that could name a recipient would be one
 * typo away from mailing someone else under this client's name.
 */
export interface SendClientEmailRequest {
  /** 1..998 characters. */
  subject: string
  /** 1..20000 characters, plain text. */
  body_text: string
  /** uuid of the client's letter being answered — keeps the thread. */
  in_reply_to_message_id?: string
}

/** `201` answer of the send door. */
export interface SendClientEmailResponse {
  message_id: string
  thread_id: string
  sent_at: string
}

export interface ClientEmailListParams {
  limit?: number
  offset?: number
}

/* ─── Contract assumptions (checked by `tsc`, nothing runs) ─────────────────
   Each line names a field or value a branch of the screen stands on. */

/** `true` passes, `false` fails the build with the alias name. */
type Assert<T extends true> = T
type Has<T, K extends string> = K extends keyof T ? true : false
type Includes<Union, V extends string> = V extends Union ? true : false

/** Sub-tab visibility: without `enabled` the tab would show on a channel that is off. */
export type _capabilities_has_enabled = Assert<Has<ClientEmailCapabilities, 'enabled'>>
/** «Написати листа» is gated on it; losing it would offer sending to everyone. */
export type _capabilities_has_can_send = Assert<Has<ClientEmailCapabilities, 'can_send'>>
/** Only this value opens the list — anything else is the «not connected» notice. */
export type _mailbox_connected = Assert<Includes<ProjectMailboxState, 'connected'>>
/** Direction label: a rename would show the client's answer as ours. */
export type _direction_incoming = Assert<Includes<ClientEmailDirection, 'incoming'>>
export type _direction_outbound = Assert<Includes<ClientEmailDirection, 'outbound'>>
/** The «системний» mark. */
export type _channel_system = Assert<Includes<ClientEmailChannel, 'system'>>
/** Time column and the order the server promised. */
export type _message_has_at = Assert<Has<ClientEmailMessage, 'at'>>
/** The reading modal renders text; with the field renamed it would render nothing. */
export type _detail_has_body_text = Assert<Has<ClientEmailMessageDetail, 'body_text'>>
export type _detail_has_quarantine = Assert<Has<ClientEmailMessageDetail, 'is_quarantined'>>
/** The HTML body is not part of the contract, and the card must never grow a use for it. */
export type _detail_has_no_body_html = Assert<
  Has<ClientEmailMessageDetail, 'body_html'> extends false ? true : false
>
/** The request cannot carry a recipient — see `SendClientEmailRequest`. */
export type _send_has_no_to_address = Assert<
  Has<SendClientEmailRequest, 'to_address'> extends false ? true : false
>
