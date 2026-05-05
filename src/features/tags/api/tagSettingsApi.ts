/**
 * Tag Settings API Client
 *
 * Wraps `/api/v1/tags/{settings,event-registry}`. Backend owns merging stored
 * value with defaults — frontend just sends/receives full documents.
 *
 * `event-registry` is read-only; PUT/POST endpoints intentionally absent.
 */

import api from '@/lib/api'

export interface TagSettingsValue {
  // Opaque to the API client — shape lives in `tagConfigStore`.
  // Top-level keys: categories, visibilities, expiryTypes, presetColors,
  // triggerTypes, actionTypes, conditionFields, operators, refreshModes,
  // rulePresets, segmentPresets.
  [key: string]: unknown
}

export interface TagSettingsResponse {
  project_id: number
  schema_version: number
  value: TagSettingsValue
  updated_at: string
  updated_by: number | null
  is_default: boolean
  missing_keys: string[]
}

export interface PayloadField {
  name: string
  type: string
  required: boolean
  description: string
}

export interface EventDescriptor {
  event_type: string
  source_service: string
  description: string
  fields: PayloadField[]
}

export interface EventRegistryResponse {
  schema_version: string
  events: EventDescriptor[]
}

export async function getTagSettings(): Promise<TagSettingsResponse> {
  const response = await api.get<TagSettingsResponse>('/api/v1/tags/settings')
  return response.data
}

export async function putTagSettings(value: TagSettingsValue): Promise<TagSettingsResponse> {
  const response = await api.put<TagSettingsResponse>('/api/v1/tags/settings', { value })
  return response.data
}

export async function resetTagSettings(): Promise<{
  project_id: number
  schema_version: number
  value: TagSettingsValue
}> {
  const response = await api.post('/api/v1/tags/settings/reset')
  return response.data
}

export async function getEventRegistry(): Promise<EventRegistryResponse> {
  const response = await api.get<EventRegistryResponse>('/api/v1/tags/event-registry')
  return response.data
}
