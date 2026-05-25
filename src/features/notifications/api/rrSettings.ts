import api from '@/lib/api'

export interface RRNotificationSettings {
  project_id: number
  enabled: boolean
  days_before: number[]
  template_text: string
}

export interface RRNotificationSettingsUpdate {
  enabled: boolean
  days_before: number[]
  template_text: string
}

const BASE_URL = '/api/v1/rr-notification-settings'

export async function getRRNotificationSettings(
  projectId: number
): Promise<RRNotificationSettings> {
  const response = await api.get<RRNotificationSettings>(BASE_URL, {
    params: { project_id: projectId },
  })
  return response.data
}

export async function updateRRNotificationSettings(
  projectId: number,
  payload: RRNotificationSettingsUpdate
): Promise<RRNotificationSettings> {
  const response = await api.put<RRNotificationSettings>(BASE_URL, payload, {
    params: { project_id: projectId },
  })
  return response.data
}
