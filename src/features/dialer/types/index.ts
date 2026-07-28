/**
 * Dialer feature types (KAN-379 — Aggressive Dialer)
 *
 * Domain model for the automated outbound dialer. Field shapes marked
 * "backend TBD" must be reconciled with the dialer service once its API
 * contract is finalized (see repo-docs/frontend/KAN-379-aggressive-dialer-frontend-plan.md §6).
 */

/** Telephony line type — set at queue creation only, immutable afterwards. */
export type TelephonyType = 'white' | 'grey'

/** How a routed live call reaches the operator. */
export type AnswerMode = 'auto' | 'manual'

/** Queue (a.k.a. campaign / preset) activity state. */
export type QueueStatus = 'active' | 'paused' | 'empty' | 'inactive'

/** Per-number call result (final status mapping confirmed with telephony team). */
export type CallResult =
  | 'busy'
  | 'unreachable'
  | 'no_answer'
  | 'line_error'
  | 'answering_machine'
  | 'abandoned'
  | 'completed'

/** Operator connection state within a dialer session. */
export type OperatorDialerStatus = 'active' | 'paused' | 'not_connected'

/**
 * A dialer queue / campaign / preset. One row in the supervisor Queue List
 * and one card in the operator campaign list.
 */
export interface DialerQueue {
  id: number
  name: string
  /** Departments this queue targets (multi-select). Empty = all departments. */
  department_ids: number[]
  /** Denormalized department labels, parallel to department_ids. */
  department_names: string[]
  /** Access groups that may operate this queue (multi-select). Empty = all groups. */
  access_groups: string[]
  priority: number
  telephony_type: TelephonyType
  sim_card_limit: number
  /** SIM cards dialing simultaneously per connected operator. */
  aggressiveness: number
  /** Seconds paused after a call ends before dialing resumes. */
  wait_time_seconds: number
  /** Max seconds a live client is held waiting for a free operator. */
  max_client_wait_seconds: number
  hold_music_url?: string | null
  hold_music_delay_seconds?: number
  answer_mode: AnswerMode
  /** Allowed calling hours, "HH:MM" 24h. */
  calling_hours_start?: string
  calling_hours_end?: string
  status: QueueStatus
  is_active: boolean
  // Live counters shown on cards / list.
  total_in_queue?: number
  remaining?: number
  completed?: number
  operators_connected?: number
  created_at?: string
  updated_at?: string
}

/**
 * Paginated Queue List response (GET /dialer/queues/paged). `total` follows the
 * active filter (drives pagination + "Found: N"); `total_all` / `total_active`
 * always carry both counts so the All / Only-active filter badges stay accurate.
 */
export interface PagedDialerQueues {
  items: DialerQueue[]
  total: number
  total_all: number
  total_active: number
  page: number
  page_size: number
}

/** A single number waiting in / processed by a queue. */
export interface QueueNumber {
  id: number
  queue_id: number
  client_id: number
  phone_number: string
  comment?: string | null
  result?: CallResult | null
  called_at?: string | null
}

/** Aggregate queue counters for the Queue-of-Numbers KPI strip. */
export interface QueueStatusCounts {
  in_queue: number
  processed: number
  missed_call: number
  line_errors: number
}

/** Result of a CSV upload dry-run (validated, not yet committed). */
export interface QueueUploadResult {
  total_records: number
  duplicates_removed: number
  invalid_count: number
  invalid_rows?: Array<{ row: number; reason: string }>
  will_be_added: number
  /** Server-issued token identifying this validated batch; passed to confirm. */
  upload_token?: string
}

/** How a confirmed upload is merged into the existing queue. */
export type QueueUploadMode = 'append' | 'replace'

/** Operator session state (join/leave surface). */
export interface DialerSession {
  queue_id: number | null
  status: OperatorDialerStatus
  auto_connect: boolean
}

/** Per-operator row on the Analysis tab. */
export interface OperatorDialerStats {
  operator_id: number
  operator_name: string
  operator_email?: string
  status: 'in_conversation' | 'awaiting_call'
  in_line_since?: string
  time_in_line_seconds: number
  talk_time_seconds: number
  utilization_pct: number
  processed: number
  current_call_phone?: string | null
  current_call_duration_seconds?: number | null
}

/** Per-SIM row on the Analysis tab (SIM Card Statistics). */
export interface SimCardStats {
  sim_id: string
  calls_made: number
  error_count: number
  status: 'active' | 'disabled'
}

/**
 * A live call routed to the operator (design: operator-02). Emitted by the
 * dialer when a live-answered call is bridged to a free operator.
 * NOTE: the transport + exact payload depend on the telephony/AMD stack
 * decision (plan §7.1) and must be confirmed with the dev team.
 */
export interface RoutedCall {
  call_id: string
  client_id: number
  client_name: string
  phone: string
  line_type: TelephonyType
  started_at: string
  /** Optional debt/loan context for the interaction + TA chain. */
  debt_id?: number | null
}
