/**
 * Calling window + holiday calendar API (KAN-1107).
 *
 * Kept separate from projectsApi for the same reason the backend keeps these
 * routes off `PUT /projects/{id}`: this is a compliance control, and editing a
 * project name should not touch the rules that decide whether a call is legal.
 */

import api from '@/lib/api'
import type {
  CallingWindowConfig,
  CallingWindowInput,
  HolidayCalendar,
  HolidayCountry,
  HolidayDate,
} from '../types'

export async function getCallingWindow(projectId: number): Promise<CallingWindowConfig> {
  const response = await api.get<CallingWindowConfig>(
    `/api/v1/projects/${projectId}/calling-window`
  )
  return response.data
}

export async function setCallingWindow(
  projectId: number,
  data: CallingWindowInput
): Promise<CallingWindowConfig> {
  const response = await api.put<CallingWindowConfig>(
    `/api/v1/projects/${projectId}/calling-window`,
    data
  )
  return response.data
}

// Not under /api/v1/projects/: that prefix already serves GET /{project_id},
// which parsed "holiday-countries" as a project id and 422'd. The catalogue is
// global rather than per-project, so it has its own prefix.
export async function getHolidayCountries(): Promise<HolidayCountry[]> {
  const response = await api.get<HolidayCountry[]>('/api/v1/calling-window/countries')
  return response.data
}

export async function getSubdivisions(country: string): Promise<string[]> {
  const response = await api.get<string[]>(
    `/api/v1/calling-window/countries/${country}/subdivisions`
  )
  return response.data
}

/**
 * Reads a year's calendar. Throws 404 when none has been generated — which the
 * caller must not flatten into an empty list: "not generated" and "generated,
 * no holidays" are different states and only one of them is safe to call on.
 */
export async function getHolidayCalendar(
  projectId: number,
  year: number
): Promise<HolidayCalendar> {
  const response = await api.get<HolidayCalendar>(
    `/api/v1/projects/${projectId}/holiday-calendar/${year}`
  )
  return response.data
}

export async function generateHolidayCalendar(
  projectId: number,
  year: number,
  replace = false
): Promise<HolidayCalendar> {
  const response = await api.post<HolidayCalendar>(
    `/api/v1/projects/${projectId}/holiday-calendar/${year}/generate`,
    null,
    { params: { replace } }
  )
  return response.data
}

export async function addHolidayDate(
  projectId: number,
  year: number,
  holidayDate: string,
  name?: string
): Promise<HolidayDate> {
  const response = await api.post<HolidayDate>(
    `/api/v1/projects/${projectId}/holiday-calendar/${year}/dates`,
    { holiday_date: holidayDate, name: name || null }
  )
  return response.data
}

export async function removeHolidayDate(
  projectId: number,
  year: number,
  holidayDate: string
): Promise<void> {
  await api.delete(`/api/v1/projects/${projectId}/holiday-calendar/${year}/dates/${holidayDate}`)
}

export async function confirmHolidayCalendar(
  projectId: number,
  year: number
): Promise<HolidayCalendar> {
  const response = await api.post<HolidayCalendar>(
    `/api/v1/projects/${projectId}/holiday-calendar/${year}/confirm`
  )
  return response.data
}
