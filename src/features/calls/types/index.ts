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
export interface CallStateEvent {
  event_type: 'call.state.changed'
  call_id: string
  current_state: CallState
  data: {
    call_id: string
    state: CallState
    duration?: number
    [key: string]: unknown
  }
}

export interface ConnectionStatus {
  connected: boolean
  reconnecting: boolean
  failedAttempts: number
  usingPollingFallback: boolean
}

// Incoming call types
export interface LoanInfo {
  loan_id: number
  contract_number: string
  remaining_debt: number
  status: string
}

export interface IncomingCallData {
  call_id: string
  customer_phone: string
  agent_extension: string
  client_name?: string
  loan_count: number
  total_debt: number
  loans: LoanInfo[]
}

export interface IncomingCallEvent {
  event_type: 'call.incoming'
  data: IncomingCallData
}
