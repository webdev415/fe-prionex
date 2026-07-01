import { useQuery } from '@tanstack/react-query'
import { getOneOnOneCalendar } from '../api/oneOnOnesService'
import type { OneOnOneCalendarFilters } from '../types/oneOnOnes'

export const oneOnOnesKeys = {
  all: ['training', 'one-on-ones'] as const,
  calendar: (filters: OneOnOneCalendarFilters) =>
    [...oneOnOnesKeys.all, 'calendar', filters] as const,
}

export function useOneOnOneCalendar(filters: OneOnOneCalendarFilters = {}, enabled = true) {
  return useQuery({
    queryKey: oneOnOnesKeys.calendar(filters),
    queryFn: () => getOneOnOneCalendar(filters),
    enabled,
    staleTime: 30_000,
  })
}
