import { api } from '@/lib/api'
import type {
  CalibrationCalendarFilters,
  CalibrationCalendarResponse,
  CalibrationSessionCard,
  CreateCalibrationSessionPayload,
} from '../types/calibrationSessions'

const BASE = '/api/v1/quality/calibration-sessions'

export async function getCalibrationCalendar(
  filters: CalibrationCalendarFilters = {}
): Promise<CalibrationCalendarResponse> {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  const response = await api.get<CalibrationCalendarResponse>(`${BASE}/calendar`, {
    params,
  })
  return response.data
}

export async function createCalibrationSession(
  payload: CreateCalibrationSessionPayload
): Promise<CalibrationSessionCard> {
  const response = await api.post<CalibrationSessionCard>(BASE, payload)
  return response.data
}

export async function rescheduleCalibrationSession(
  id: number,
  scheduledAt: string
): Promise<CalibrationSessionCard> {
  const response = await api.post<CalibrationSessionCard>(`${BASE}/${id}/reschedule`, {
    scheduled_at: scheduledAt,
  })
  return response.data
}

export async function completeCalibrationSession(
  id: number
): Promise<CalibrationSessionCard> {
  const response = await api.post<CalibrationSessionCard>(`${BASE}/${id}/complete`)
  return response.data
}

export async function cancelCalibrationSession(
  id: number
): Promise<CalibrationSessionCard> {
  const response = await api.post<CalibrationSessionCard>(`${BASE}/${id}/cancel`)
  return response.data
}
