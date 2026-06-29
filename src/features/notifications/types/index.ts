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
