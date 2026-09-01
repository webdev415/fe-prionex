import { useInfiniteQuery } from '@tanstack/react-query'
import { getEmployeeEvents } from '../api/employeeEventsApi'
import type { EmployeeEventPage, EmployeeEventQuery } from '../types'

export const employeeEventKeys = {
  all: ['employee-events'] as const,
  timeline: (userId: number, query: EmployeeEventQuery) =>
    ['employee-events', userId, query] as const,
}

export function useEmployeeEvents(userId: number, query: EmployeeEventQuery = {}) {
  return useInfiniteQuery({
    queryKey: employeeEventKeys.timeline(userId, query),
    queryFn: ({ pageParam }) => getEmployeeEvents(userId, query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: EmployeeEventPage) => lastPage.next_cursor ?? undefined,
    enabled: userId > 0,
  })
}
