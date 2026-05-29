export type CallMonitoringPeriod = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'custom'

export type CallMonitoringSort = 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc'

// KAN-490: granular DialStatus-derived outcomes in the Call List status filter.
// `not_answered` is the legacy rollup — removed from the UI dropdown but kept
// in the type and backend so existing bookmarks with `?status=not_answered`
// keep working.
export type CallMonitoringOutcomeFilter =
  | 'all'
  | 'answered'
  | 'no_answer'
  | 'busy'
  | 'cancel'
  | 'unavailable'
  | 'congestion'
  // `failed` is a state, not an outcome — set when the call never connected
  // (originate failure, hangup-with-no-channel, stale-call cleanup).
  | 'failed'
  | 'not_answered'

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

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'extended'
  | 'rejected'
  | 'incoming_line_result'

export type TaskHistorySort =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'due_date_asc'
  | 'due_date_desc'

export interface TaskHistoryFilters {
  date_from?: string
  date_to?: string
  due_date_from?: string
  due_date_to?: string
  assigned_to_user_ids?: number[]
  created_by_in?: number[]
  group_id?: number
  subject_id?: number
  priority?: TaskPriority
  status?: TaskStatus
  sort?: TaskHistorySort
  skip?: number
  limit?: number
}

export interface TaskHistoryItem {
  id: number
  project_id: number
  client_id: number | null
  debt_id: number | null
  subject_id: number | null
  subject_name: string | null
  subject_code: string | null
  title: string
  description: string | null
  comment: string | null
  priority: TaskPriority | string
  status: TaskStatus | string
  due_date: string | null
  is_overdue: boolean
  assigned_to_user_id: number | null
  assigned_to_username: string | null
  is_dismissed: boolean
  created_at: string | null
  updated_at: string | null
  created_by: number
  created_by_name: string | null
  legacy_id: string | null
}

export interface TaskHistoryResponse {
  items: TaskHistoryItem[]
  total: number
  skip: number
  limit: number
}

export interface TaskHistoryAnalyticsBucket {
  date: string
  count: number
}

export interface TaskHistoryAnalyticsResponse {
  buckets: TaskHistoryAnalyticsBucket[]
  total: number
}

export interface TaskHistoryAnalyticsFilters {
  date_from?: string
  date_to?: string
  due_date_from?: string
  due_date_to?: string
  assigned_to_user_ids?: number[]
  created_by_in?: number[]
  group_id?: number
  subject_id?: number
  priority?: TaskPriority
  status?: TaskStatus
}

export interface TaskSubject {
  id: number
  code: string
  name: string
  name_en?: string | null
}

// ---------------------------------------------------------------------------
// Payment Monitoring (KAN-506)
// ---------------------------------------------------------------------------

export type PaymentMethod = 'bank_transfer' | 'online_gateway' | 'cash' | 'card' | 'other'

export type PaymentStatus = 'pending' | 'verified' | 'cancelled'

/** KAN-507 controlled-vocabulary values stored on payments.payment_type. */
export type PaymentType = 'payment_by_rr' | 'partial_payment' | 'full_payment'

export const PAYMENT_METHOD_VALUES: readonly PaymentMethod[] = [
  'bank_transfer',
  'online_gateway',
  'cash',
  'card',
  'other',
]
export const PAYMENT_STATUS_VALUES: readonly PaymentStatus[] = ['pending', 'verified', 'cancelled']
export const PAYMENT_TYPE_VALUES: readonly PaymentType[] = [
  'payment_by_rr',
  'partial_payment',
  'full_payment',
]

export type PaymentMonitoringSort =
  | 'recorded_at_desc'
  | 'recorded_at_asc'
  | 'verified_at_desc'
  | 'verified_at_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'payment_date_desc'
  | 'payment_date_asc'

export interface PaymentMonitoringFilters {
  period?: CallMonitoringPeriod
  /** Top date range — always filters Payment.recorded_at (Created at). */
  from_datetime?: string
  to_datetime?: string
  /** Independent Confirmed-at range (Payment.verified_at). ISO datetime. */
  verified_at_from?: string
  verified_at_to?: string
  /** Independent Payment-date range (Payment.payment_date). YYYY-MM-DD. */
  payment_date_from?: string
  payment_date_to?: string
  user_ids?: number[]
  payment_method_in?: PaymentMethod[]
  status_in?: PaymentStatus[]
  payment_type_in?: PaymentType[]
  /** Free-text substring (ILIKE '%term%') over payments.payment_comment. */
  payment_comment_search?: string
  amount_min?: number
  amount_max?: number
  sort?: PaymentMonitoringSort
  page?: number
  limit?: number
}

export interface PaymentMonitoringItem {
  id: number
  payment_number: string
  client_id: number
  debt_id: number | null
  /** Cross-service enrichment from the client service (KAN-506). */
  debt_contract_number: string | null
  seller_company: string | null
  purchase_date: string | null // YYYY-MM-DD
  payment_type: PaymentType | null
  payment_comment: string | null
  recorded_by_user_id: number | null
  recorded_by_full_name: string | null
  recorded_at: string | null
  verified_at: string | null
  amount: string
  payment_method: PaymentMethod
  status: PaymentStatus
}

export interface PaymentMonitoringSummary {
  total_payments: number
  total_amount: string
  verified_amount: string
  pending_amount: string
}

export interface PaymentMonitoringResponse {
  items: PaymentMonitoringItem[]
  summary: PaymentMonitoringSummary
  total: number
  page: number
  limit: number
}
