// TypeScript enums for type safety (from audit MEDIUM-2)
export const CallOutcome = {
  ANSWERED: 'answered',
  NO_ANSWER: 'no_answer',
  BUSY: 'busy',
  FAILED: 'failed',
  VOICEMAIL: 'voicemail',
  WRONG_NUMBER: 'wrong_number',
} as const

export type CallOutcome = (typeof CallOutcome)[keyof typeof CallOutcome]

// Backend returns UPPERCASE values to match database enum
export const CallState = {
  INITIATED: 'INITIATED',
  RINGING: 'RINGING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const

export type CallState = (typeof CallState)[keyof typeof CallState]

// Call API request/response interfaces
export interface OriginateCallRequest {
  agent_extension: string
  customer_number: string
  caller_id_name?: string
  caller_id_number?: string
  campaign_id?: string
  client_id?: number
  metadata?: Record<string, unknown>
  context?: string
}

export interface OriginateCallResponse {
  call_id: string
  status: 'initiated' | 'failed'
  message?: string
  initiated_at: string
}

export interface CallDetail {
  call_id: string
  agent_extension: string
  customer_number: string
  direction?: string | null
  state: CallState
  initiated_at: string
  ringing_at?: string
  answered_at?: string
  ended_at?: string
  ring_duration?: number
  talk_duration?: number
  total_duration?: number
  recording_path?: string
  outcome?: CallOutcome
  disposition?: string
  notes?: string
  telephony_type?: string | null
}

/** Lean per-call projection returned by POST /api/v1/calls/batch. */
export interface CallBatchItem {
  call_id: string
  customer_number: string
  client_id: number | null
}

export interface CallHistoryFilters {
  outcome?: CallOutcome
  from_date?: string
  to_date?: string
  page?: number
  limit?: number
}

export interface CallHistoryResponse {
  calls: CallDetail[]
  total: number
}

export interface UpdateCallOutcomeRequest {
  outcome: CallOutcome
  disposition?: string
  notes?: string
  follow_up_date?: string
}

export interface AMIHealthResponse {
  status: string
  ami_connected: boolean
}

// WebSocket event interfaces

// Underscore, unlike the dotted "call.state.changed" RabbitMQ domain event that
// client-service consumes. See services/call/app/services/event_listener.py.
export const CALL_STATE_CHANGED_EVENT = 'call.state_changed'

// Mirrors the data block of the only call.state_changed emitter
// (event_listener.py). The index signature keeps the shared
// getClientIdFromCallEventData helper usable across event shapes.
export interface CallStateEventData {
  call_id: string
  state: CallState
  customer_number?: string
  project_id?: number
  total_duration?: number
  hangup_cause?: number
  /**
   * Set as soon as the answer is seen, ahead of `state` reaching ACTIVE — so
   * this, not `state`, is what tells you a call has been taken.
   *
   * Deliberately not `CallOutcome`: the call-service records this as a free
   * string and emits values outside that union — `rejected`, `missed`, and the
   * Asterisk dispositions rendered in `lib/callOutcome.ts` (`cancel`,
   * `unavailable`, `congestion`, …). Typing it as the union would promise an
   * exhaustiveness that does not hold on the wire. Compare against
   * `CallOutcome.ANSWERED` after lower-casing.
   */
  outcome?: string | null
  /**
   * The operator who picked up, present only when that is actually known —
   * i.e. the answering leg's channel was identifiable. Absent means "somebody
   * answered but we cannot say who", which consumers should treat as unknown
   * rather than falling back to a guess.
   */
  answered_by?: string | null
  /**
   * The record's current agent, which changes meaning as the call progresses:
   * the first-rung operator while the queue is still ringing, and the answerer
   * once the answering leg has been adopted — which happens at DialEnd, before
   * `state` reaches ACTIVE.
   *
   * Adoption only occurs when the answering channel is identifiable, so this is
   * not a reliable answer to "who picked up". Use `answered_by` for that.
   */
  agent_extension?: string
  [key: string]: unknown
}

export interface CallStateEvent {
  event_type: string
  timestamp: string
  data: CallStateEventData
}

export interface ConnectionStatus {
  connected: boolean
  reconnecting: boolean
  failedAttempts: number
  usingPollingFallback: boolean
  serviceUnavailable: boolean
}

// Incoming call types
export interface LoanInfo {
  loan_id: number
  client_id?: number
  contract_number: string
  remaining_debt: string
  principal_amount?: number | null
  status: string
  seller_name?: string | null
  purchase_date?: string | null
}

export interface IncomingCallInteraction {
  id: number
  interaction_date: string | null
  type_name: string | null
  result_name: string | null
  direction: string | null
  channel: string | null
  summary: string | null
  user_name: string | null
}

/**
 * One client the calling number resolved to. More than one entry means the
 * number is shared and the operator has to choose which client the call is
 * about; none means the caller is unknown to this project.
 */
export interface IncomingCallClient {
  client_id: number
  client_name: string
  responsible_employee_id: number | null
  contact_comment: string | null
  contact_source: string | null
  contact_type_name: string | null
  /**
   * Whose number this is, derived by the client-service from the contact
   * type's stable code. `contact_source` cannot stand in for it: guarantors
   * and third parties are both stored as 'recommender'.
   */
  contact_category: 'client' | 'guarantor' | 'third_party' | 'other' | null
  recent_interactions: IncomingCallInteraction[]
  loans: LoanInfo[]
}

export interface IncomingCallData {
  call_id: string
  customer_phone: string
  agent_extension: string
  client_name?: string
  client_id?: number | null
  project_id?: number | null
  loan_count: number
  total_debt: string
  loans: LoanInfo[]
  clients?: IncomingCallClient[]
}

export interface IncomingCallEvent {
  event_type: 'call.incoming'
  data: IncomingCallData
}
