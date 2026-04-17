import api from '@/lib/api'

import type {
  NotificationListResponse,
  NotificationPreferences,
  UnreadCountResponse,
} from '../types'

const BASE_URL = '/api/v1/notifications'

export async function getNotifications(params: {
  page?: number
  page_size?: number
  type?: string
  read?: boolean
}): Promise<NotificationListResponse> {
  const response = await api.get<NotificationListResponse>(BASE_URL, { params })
  return response.data
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  const response = await api.get<UnreadCountResponse>(`${BASE_URL}/unread/count`)
  return response.data
}

export async function markAsRead(notificationId: string): Promise<void> {
  await api.patch(`${BASE_URL}/${notificationId}/read`)
}

export async function markAllAsRead(): Promise<void> {
  await api.patch(`${BASE_URL}/read-all`)
}

export async function dismissNotification(notificationId: string): Promise<void> {
  await api.delete(`${BASE_URL}/${notificationId}`)
}

export async function getPreferences(): Promise<NotificationPreferences> {
  const response = await api.get<NotificationPreferences>(`${BASE_URL}/preferences`)
  return response.data
}

export async function updatePreferences(
  enabledTypes: Record<string, boolean>
): Promise<NotificationPreferences> {
  const response = await api.put<NotificationPreferences>(`${BASE_URL}/preferences`, {
    enabled_types: enabledTypes,
  })
  return response.data
}
