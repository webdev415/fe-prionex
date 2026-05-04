import { useQuery } from '@tanstack/react-query'
import { getCallsByPhone } from '../api/actionAnalysisService'
import { callMonitoringKeys } from './useCallMonitoring'
import type { CallMonitoringSort } from '../types'

export function useCallsByPhone(
  phone: string,
  sort: CallMonitoringSort = 'date_desc',
  enabled = true
) {
  return useQuery({
    queryKey: callMonitoringKeys.byPhone(phone, sort),
    queryFn: () => getCallsByPhone({ phone, sort, limit: 200 }),
    enabled: enabled && phone.length >= 3,
    staleTime: 30_000,
  })
}
