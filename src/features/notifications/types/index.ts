export const NotificationType = {
  INCOMING_CALL: 'incoming_call',
  CALLBACK_REQUESTED: 'callback_requested',
  TASK_OVERDUE: 'task_overdue',
  // Trainer-facing: an assigned correction task (KAN-411 / Dialogue
  // Evaluation Assign task) is overdue. Call-centric metadata (call_id,
  // task_id, operator_id, trainer_id) rather than client-centric.
  CORRECTION_TASK_OVERDUE: 'correction_task_overdue',
  PAYMENT_PENDING: 'payment_pending',
  TAG_ASSIGNED: 'tag_assigned',
  TAG_REMOVED: 'tag_removed',
  TAG_EXPIRED: 'tag_expired',
  TA_CHAIN_CREATED: 'ta_chain_created',
  RR_PAYMENT_DUE: 'rr_payment_due',
  // UBKI integration alerts (Settings → Notifications): high failure rate,
  // connection down, and the daily submission summary.
  UBKI_FAILURE_ALERT: 'ubki_failure_alert',
  UBKI_CONNECTION_DOWN: 'ubki_connection_down',
  UBKI_DAILY_SUMMARY: 'ubki_daily_summary',
  // KAN-413 — Inbox / coaching: trainer schedules a 1-on-1, the 30-min
  // reminder, and a trainer taking charge of an operator's assignment.
  ONE_ON_ONE_SCHEDULED: 'one_on_one_scheduled',
  ONE_ON_ONE_REMINDER: 'one_on_one_reminder',
  ASSIGNMENT_TAKEN: 'assignment_taken',
  // KAN-411 Feature 3.1 — correction-task lifecycle pushes (assigned /
  // completed / returned; overdue is CORRECTION_TASK_OVERDUE above).
  CORRECTION_TASK_ASSIGNED: 'correction_task_assigned',
  CORRECTION_TASK_COMPLETED: 'correction_task_completed',
  CORRECTION_TASK_RETURNED: 'correction_task_returned',
  // KAN-410 — Call Monitoring & Quality Scoring feedback/score pushes.
  FEEDBACK_RECEIVED: 'feedback_received',
  FEEDBACK_REPLIED: 'feedback_replied',
  SCORECARD_SENT: 'scorecard_sent',
  SCORE_DROP_DETECTED: 'score_drop_detected',
  SCORE_GROWTH_DETECTED: 'score_growth_detected',
  // Legal workplace task deadline reminders.
  LEGAL_TASK_DUE_TOMORROW: 'legal_task_due_tomorrow',
  LEGAL_TASK_DUE_TODAY: 'legal_task_due_today',
  // KAN-752 — group-training lifecycle. Both fan out to the training's
  // participants: TRAINING_SCHEDULED when a trainer assigns them,
  // TRAINING_REMINDER 30 min before it starts.
  TRAINING_SCHEDULED: 'training_scheduled',
  TRAINING_REMINDER: 'training_reminder',
  // Trainer-facing nudge: a completed 1-on-1 still has no feedback filed.
  ONE_ON_ONE_FEEDBACK_DUE: 'one_on_one_feedback_due',
  // KAN-761 / KAN-615 — Trainings & Sessions assignment lifecycle.
  DRILL_ASSIGNED: 'drill_assigned',
  DRILL_COMPLETED: 'drill_completed',
  DRILL_CONFIRMED: 'drill_confirmed',
  DRILL_RETURNED: 'drill_returned',
  DRILL_OVERDUE: 'drill_overdue',
  COURSE_ASSIGNED: 'course_assigned',
} as const

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>
  read: boolean
  starred: boolean
  created_at: string
  read_at: string | null
}

export interface NotificationListResponse {
  items: NotificationItem[]
  total: number
  page: number
  page_size: number
}

export interface UnreadCountResponse {
  total: number
  by_type: Record<string, number>
}

export interface NotificationPreferences {
  id: string
  user_id: number
  project_id: number
  enabled_types: Record<string, boolean>
  updated_at: string | null
}
