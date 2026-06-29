import { api } from '@/lib/api'
import type { OneOnOneCalendarFilters, OneOnOneCalendarResponse } from '../types/oneOnOnes'

const BASE = '/api/v1/quality/coaching/one-on-ones'

function buildParams(filters: OneOnOneCalendarFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.scope) params.set('scope', filters.scope)
  return params
}

export async function getOneOnOneCalendar(
  filters: OneOnOneCalendarFilters = {}
): Promise<OneOnOneCalendarResponse> {
  const response = await api.get<OneOnOneCalendarResponse>(`${BASE}/calendar`, {
    params: buildParams(filters),
  })
  return response.data
}
