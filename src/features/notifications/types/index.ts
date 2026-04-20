export const NotificationType = {
  INCOMING_CALL: 'incoming_call',
  CALLBACK_REQUESTED: 'callback_requested',
  TASK_OVERDUE: 'task_overdue',
  PAYMENT_PENDING: 'payment_pending',
  TAG_ASSIGNED: 'tag_assigned',
  TAG_REMOVED: 'tag_removed',
  TAG_EXPIRED: 'tag_expired',
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
