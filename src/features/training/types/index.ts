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
  /**
   * Department slice of the call list. Empty / omitted = every department.
   * Resolved server-side (agent extension → user → department), so it also
   * covers agents missing from the caller's roster.
   */
  department_ids?: number[]
  phone_number?: string
  outcome_filter?: CallMonitoringOutcomeFilter
  min_duration?: number
  max_duration?: number
  period?: CallMonitoringPeriod
  from_datetime?: string
  to_datetime?: string
  campaign_id?: string
  telephony_types?: TelephonyType[]
  category?: ScorecardCategory
  sort?: CallMonitoringSort
  limit?: number
  offset?: number
}

export type ScorecardCategory = 'unscored' | 'low' | 'average' | 'high'

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
  has_scorecard: boolean
  scorecard_id: number | null
  scorecard_status: string | null
  scorecard_weighted_score: number | null
  scorecard_category: ScorecardCategory | null
  scorecard_comment: string | null
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
  // KAN-731 Phase B: server-side team-scope resolvers. The BE intersects
  // these with `user_ids[]` after resolving via auth-service.
  department_id?: number
  group_id?: number
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
  // KAN-731 Phase B: deal context surfaced as the "Угода" column on the
  // Interactions sub-tab.
  debt_id: number | null
  contract_number: string | null
}

export interface InteractionMonitoringResponse {
  items: InteractionMonitoringItem[]
  total: number
  page: number
  page_size: number
}

// --- Promises and Callbacks sub-tab (KAN-733) ---

export type PromiseCallbackSortBy = 'date' | 'amount'

export type PromiseCallbackStatus = 'paid' | 'overdue' | 'pending'

export interface PromiseCallbackFilters {
  user_ids?: number[]
  // KAN-731 Phase B server-side team-scope resolvers (intersected by the BE).
  department_id?: number
  group_id?: number
  period?: CallMonitoringPeriod
  from_datetime?: string
  to_datetime?: string
  sort_by?: PromiseCallbackSortBy
  sort_dir?: InteractionMonitoringSortDir
  page?: number
  page_size?: number
}

export interface PromiseCallbackItem extends InteractionMonitoringItem {
  promise_fulfilled: boolean | null
  // Effective due date for the "Термін оплати" column: the promise date when
  // present, else `follow_up_date` for callback-only rows.
  payment_term_date: string | null
  status: PromiseCallbackStatus
}

export interface PromiseCallbackSummaryCards {
  total_promises_amount: string
  paid_amount: string
  overdue_count: number
  pending_amount: string
}

export interface PromisesAndCallbacksResponse {
  summary_cards: PromiseCallbackSummaryCards
  items: PromiseCallbackItem[]
  total: number
  page: number
  page_size: number
}

// --- Leaks sub-tab (KAN-735) ---

export type LeakSortBy = 'date' | 'amount'

// Request-only filter ('all' shows both classes); the item itself is one of
// the two concrete states below.
export type LeakFollowUpStatusFilter = 'all' | 'not_followed_up' | 'followed_up'
export type LeakFollowUpStatus = 'followed_up' | 'not_followed_up'

export interface LeakFilters {
  user_ids?: number[]
  // KAN-731 Phase B server-side team-scope resolvers (intersected by the BE).
  department_id?: number
  group_id?: number
  period?: CallMonitoringPeriod
  from_datetime?: string
  to_datetime?: string
  // Window (days, from the promise due date) within which a later call counts
  // as a follow-up. KAN-735 Block 3 — default 5 until the settings ticket ships.
  lookback_days?: number
  follow_up_status?: LeakFollowUpStatusFilter
  sort_by?: LeakSortBy
  sort_dir?: InteractionMonitoringSortDir
  page?: number
  page_size?: number
}

export interface LeakItem {
  id: number
  // When the operator logged the overdue promise (the "escalation").
  escalation_date: string
  operator_id: number | null
  operator_name: string | null
  client_id: number
  client_full_name: string | null
  agreement_id: number | null
  contract_number: string | null
  promise_amount: string | null
  promise_date: string | null
  follow_up_status: LeakFollowUpStatus
  // Earliest later call with the same client inside the lookback window; null
  // ⇒ "No call".
  last_call_after_escalation_at: string | null
}

export interface LeakKpis {
  total_escalations: number
  not_followed_up: number
  followed_up: number
}

export interface LeaksResponse {
  kpis: LeakKpis
  items: LeakItem[]
  total: number
  page: number
  page_size: number
}

// --- Third Parties sub-tab (KAN-736) ---

export type ThirdPartySortBy = 'date' | 'duration'

// Mock-vocabulary result chips ('all' is request-only). KAN-736 §3.
export type ThirdPartyResultChip = 'promise' | 'refusal' | 'missed_call' | 'will_pass_on'
export type ThirdPartyResultFilter = 'all' | ThirdPartyResultChip
// Server-derived; the FE collapses this onto two visual states (Yes / Did not return).
export type ThirdPartyReturnedStatus = 'yes' | 'will_pass' | 'did_not_pass'

export interface ThirdPartyFilters {
  user_ids?: number[]
  department_id?: number
  group_id?: number
  period?: CallMonitoringPeriod
  from_datetime?: string
  to_datetime?: string
  result_filter?: ThirdPartyResultFilter
  // Window (hours, from the third-party call) for "returned to client". Default 24.
  returned_window_hours?: number
  sort_by?: ThirdPartySortBy
  sort_dir?: InteractionMonitoringSortDir
  page?: number
  page_size?: number
}

export interface ThirdPartyItem {
  id: number
  datetime: string
  operator_id: number | null
  operator_name: string | null
  primary_client_id: number
  primary_client_full_name: string | null
  contacted_phone: string | null
  contact_relationship: string | null
  duration_seconds: number | null
  result_code: string | null
  result_chip: ThirdPartyResultChip | null
  returned_to_client: ThirdPartyReturnedStatus | null
  returned_at: string | null
  // UUID for inline recording playback; null in v1 (KAN-736 §4, deferred).
  call_id: string | null
}

export interface ThirdPartyKpis {
  total_calls: number
  returned_to_client: number
  did_not_return: number
  positive_count: number
  refusal_count: number
  will_pass_count: number
}

export interface ThirdPartyResponse {
  kpis: ThirdPartyKpis
  items: ThirdPartyItem[]
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
// Weekly Tasks — Action Analysis sub-tab (KAN-732)
// ---------------------------------------------------------------------------

export type WeeklyDowKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface WeeklyBucketFilters {
  operator_ids?: number[]
  /** ISO datetime; lower bound on due_date. */
  from_date?: string
  /** ISO datetime; upper bound on due_date (exclusive). */
  to_date?: string
  status_in?: string[]
  priority_in?: string[]
  include_no_due_date?: boolean
}

export interface WeeklyBucket {
  /** ISO date (Monday) of the week. */
  week_start: string
  day_counts: Record<WeeklyDowKey, number>
  /** Per-day overdue counts — drives the per-day status dot. */
  day_overdue: Record<WeeklyDowKey, number>
  overdue_count: number
  total: number
}

export interface WeeklyBucketResponse {
  buckets: WeeklyBucket[]
  totals: { today: number; this_week: number; overdue: number }
  no_due_date: number
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
  assigned_user_id: number | null
  assigned_user_full_name: string | null
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

// ---------------------------------------------------------------------------
// Successful Closures — Action Analysis sub-tab (KAN-734)
// Trainer-facing list of VERIFIED payments. summary_cards + closure_leader come
// from payment-service; the Funnel + conversion % are composed on the FE from
// the interaction-monitoring + promises endpoints (those counts live in
// client-service).
// ---------------------------------------------------------------------------

export type ClosureSortBy = 'date' | 'amount'

export interface ClosureFilters {
  period?: CallMonitoringPeriod
  from_datetime?: string
  to_datetime?: string
  /** Operator scope — verified payments where assigned_user_id is in this list. */
  user_ids?: number[]
  sort_by?: ClosureSortBy
  sort_dir?: InteractionMonitoringSortDir
  page?: number
  page_size?: number
}

export interface ClosureItem {
  payment_date: string // YYYY-MM-DD — "Дата/Час"
  operator_id: number | null
  operator_name: string | null // "Оператор"
  client_id: number
  client_name: string | null // "Клієнт"
  debt_id: number | null
  contract_number: string | null // "Угода"
  amount: string // "Сума"
  payment_confirmation_date: string | null // "Дата підтвердження"
  status: string // "Статус" — constant 'verified' for v1
}

export interface ClosureSummaryCards {
  successful_closures_count: number
  total_amount: string
}

export interface ClosureLeader {
  operator_id: number
  operator_name: string | null
  closures_count: number
}

export interface ClosuresResponse {
  summary_cards: ClosureSummaryCards
  closure_leader: ClosureLeader | null
  items: ClosureItem[]
  total: number
  page: number
  page_size: number
}
