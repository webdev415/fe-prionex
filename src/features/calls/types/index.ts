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

// The Socket.IO event call-service emits is "call.state_changed" (UNDERSCORE).
// The RabbitMQ domain event is "call.state.changed" (DOTTED) and is consumed
// dotted by client-service — they are deliberately different names, so this
// constant is the single place the socket name lives.
// See services/call/app/services/event_listener.py.
export const CALL_STATE_CHANGED_EVENT = 'call.state_changed'

export interface CallStateEventData {
  call_id: string
  state: CallState
  customer_number?: string
  client_id?: unknown
  clientId?: unknown
  duration?: number
  total_duration?: number
  hangup_cause?: number
  [key: string]: unknown
}

// broadcast_to_agent (services/call/app/socketio_app.py) wraps the payload:
// {event_type, timestamp, data: {...}}. There is no top-level call_id — reading
// one yields undefined and invalidates the query key ['callDetails', undefined],
// which matches nothing. Always read through `data`.
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
  contract_number: string
  remaining_debt: string
  status: string
}

export interface IncomingCallData {
  call_id: string
  customer_phone: string
  agent_extension: string
  client_name?: string
  loan_count: number
  total_debt: string
  loans: LoanInfo[]
}

export interface IncomingCallEvent {
  event_type: 'call.incoming'
  data: IncomingCallData
}
