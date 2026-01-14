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

export const CallState = {
  INITIATED: 'initiated',
  RINGING: 'ringing',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type CallState = (typeof CallState)[keyof typeof CallState]

// Call API request/response interfaces
export interface OriginateCallRequest {
  agent_extension: string
  customer_number: string
  caller_id_name?: string
  caller_id_number?: string
  campaign_id?: string
  metadata?: Record<string, any>
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
    [key: string]: any
  }
}

export interface ConnectionStatus {
  connected: boolean
  reconnecting: boolean
  failedAttempts: number
  usingPollingFallback: boolean
}
