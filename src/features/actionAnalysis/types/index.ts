export type CallMonitoringPeriod = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'custom'

export type CallMonitoringSort = 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc'

export type CallMonitoringOutcomeFilter = 'all' | 'answered' | 'not_answered'

export type TelephonyType = 'white' | 'grey' | 'unknown'

export const TELEPHONY_TYPE_VALUES: readonly TelephonyType[] = ['white', 'grey', 'unknown']

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
  telephony_types?: TelephonyType[]
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
  telephony_type: TelephonyType
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

export type InteractionMonitoringSortBy = 'date' | 'promise_amount'
export type InteractionMonitoringSortDir = 'asc' | 'desc'

export type InteractionInternalDateType = 'promise_to_pay' | 'next_action' | 'follow_up' | 'any'

export interface InteractionMonitoringFilters {
  user_ids?: number[]
  period?: CallMonitoringPeriod
  from_datetime?: string
  to_datetime?: string
  promise_amount_min?: number
  promise_amount_max?: number
  result_ids?: number[]
  contact_type_ids?: number[]
  // KAN-409 follow-up: filter on the manager-set internal interaction dates
  // (promise / next-action / follow-up). `internal_date_type='any'` ORs
  // across all three columns; date bounds are required for the filter to
  // apply.
  internal_date_type?: InteractionInternalDateType
  internal_date_from?: string
  internal_date_to?: string
  channel?: string
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
  next_action_date: string | null
  follow_up_date: string | null
  channel: string | null
  current_responsible_user_id: number | null
  current_responsible_user_name: string | null
  summary: string | null
}

export interface InteractionMonitoringResponse {
  items: InteractionMonitoringItem[]
  total: number
  page: number
  page_size: number
}
