export type CallMonitoringPeriod = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'custom'

export type CallMonitoringSort = 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc'

export type CallMonitoringOutcomeFilter = 'all' | 'answered' | 'not_answered'

export interface CallMonitoringFilters {
  agent_extensions?: string[]
  phone_number?: string
  outcome_filter?: CallMonitoringOutcomeFilter
  min_duration?: number
  max_duration?: number
  period?: CallMonitoringPeriod
  from_datetime?: string
  to_datetime?: string
  campaign_id?: string
  sort?: CallMonitoringSort
  limit?: number
  offset?: number
}

export interface CallMonitoringItem {
  call_id: string
  agent_extension: string
  customer_number: string
  direction: string | null
  state: string
  outcome: string | null
  initiated_at: string
  answered_at: string | null
  ended_at: string | null
  ring_duration: number | null
  talk_duration: number | null
  total_duration: number | null
  client_id: number | null
  campaign_id: string | null
  has_recording: boolean
}

export interface CallMonitoringSummary {
  total_calls: number
  answered_calls: number
  outgoing_calls: number
}

export interface CallMonitoringResponse {
  calls: CallMonitoringItem[]
  summary: CallMonitoringSummary
  total: number
  limit: number
  offset: number
}

export interface CallsByPhoneFilters {
  phone: string
  sort?: CallMonitoringSort
  limit?: number
  offset?: number
}

export type InteractionMonitoringSortBy = 'date' | 'promise_amount'
export type InteractionMonitoringSortDir = 'asc' | 'desc'

export interface InteractionMonitoringFilters {
  user_ids?: number[]
  period?: CallMonitoringPeriod
  from_datetime?: string
  to_datetime?: string
  promise_amount_min?: number
  promise_amount_max?: number
  result_ids?: number[]
  contact_type_ids?: number[]
  sort_by?: InteractionMonitoringSortBy
  sort_dir?: InteractionMonitoringSortDir
  page?: number
  page_size?: number
}

export interface InteractionMonitoringItem {
  id: number
  interaction_date: string
  client_id: number
  client_full_name: string | null
  phone_used: string | null
  user_id: number | null
  user_name: string | null
  contact_type_id: number | null
  contact_type_name: string | null
  contact_type_code: string | null
  result_id: number | null
  result_name: string | null
  result_code: string | null
  promise_to_pay_amount: string | null
  promise_to_pay_date: string | null
  summary: string | null
}

export interface InteractionMonitoringResponse {
  items: InteractionMonitoringItem[]
  total: number
  page: number
  page_size: number
}
