import api from '@/lib/api'
import type { EmployeeEventPage, EmployeeEventQuery } from '../types'

/**
 * One page of somebody's chronology.
 *
 * The cursor names the last row read rather than counting how many were
 * skipped, so an event landing while somebody reads cannot hide a row on the
 * seam between two pages.
 */
export async function getEmployeeEvents(
  userId: number,
  query: EmployeeEventQuery = {},
  cursor?: string | null
): Promise<EmployeeEventPage> {
  const response = await api.get<EmployeeEventPage>(`/api/v1/admin/users/${userId}/events`, {
    params: { ...query, cursor: cursor || undefined },
  })
  return response.data
}
