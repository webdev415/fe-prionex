import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getCallMonitoring } from '../api/actionAnalysisService'
import type { CallMonitoringFilters } from '../types'

export const callMonitoringKeys = {
  all: ['action-analysis', 'calls'] as const,
  list: (filters: CallMonitoringFilters) => [...callMonitoringKeys.all, 'list', filters] as const,
  byPhone: (phone: string, sort?: string) =>
    [...callMonitoringKeys.all, 'by-phone', phone, sort] as const,
}

export function useCallMonitoring(filters: CallMonitoringFilters, enabled = true) {
  return useQuery({
    queryKey: callMonitoringKeys.list(filters),
    queryFn: () => getCallMonitoring(filters),
    enabled,
    staleTime: 30_000,
    // Keep the previous page/filter result on screen while the next one
    // loads: every keystroke in the trainer's filter bar changes the key,
    // and without this the table collapsed into "Loading…" each time.
    placeholderData: keepPreviousData,
  })
}
