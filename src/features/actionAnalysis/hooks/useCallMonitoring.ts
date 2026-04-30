import { useQuery } from '@tanstack/react-query'
import { getCallMonitoring } from '../api/actionAnalysisService'
import type { CallMonitoringFilters } from '../types'

export const callMonitoringKeys = {
  all: ['action-analysis', 'calls'] as const,
  list: (filters: CallMonitoringFilters) =>
    [...callMonitoringKeys.all, 'list', filters] as const,
  byPhone: (phone: string, sort?: string) =>
    [...callMonitoringKeys.all, 'by-phone', phone, sort] as const,
}

export function useCallMonitoring(filters: CallMonitoringFilters, enabled = true) {
  return useQuery({
    queryKey: callMonitoringKeys.list(filters),
    queryFn: () => getCallMonitoring(filters),
    enabled,
    staleTime: 30_000,
  })
}
