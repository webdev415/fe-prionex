import api from '@/lib/api'

import type { PeriodicityType } from '../utils/rrSchedule'

/**
 * RR payment-periodicity settings (KAN-785 Part 1). Per-project; the backend
 * keys off the caller's active project (no project_id param).
 */
export interface RRPeriodicitySettings {
  project_id: number
  enabled_types: PeriodicityType[]
}

export interface RRPeriodicitySettingsUpdate {
  enabled_types: PeriodicityType[]
}

const BASE_URL = '/api/v1/rr-periodicity-settings'

export async function getRRPeriodicitySettings(): Promise<RRPeriodicitySettings> {
  const response = await api.get<RRPeriodicitySettings>(BASE_URL)
  return response.data
}

export async function updateRRPeriodicitySettings(
  payload: RRPeriodicitySettingsUpdate
): Promise<RRPeriodicitySettings> {
  const response = await api.put<RRPeriodicitySettings>(BASE_URL, payload)
  return response.data
}
