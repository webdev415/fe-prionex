import { useQuery } from '@tanstack/react-query'
import { getPaymentMonitoring } from '../api/actionAnalysisService'
import type { PaymentMonitoringFilters } from '../types'

export const paymentMonitoringKeys = {
  all: ['action-analysis', 'payment-monitoring'] as const,
  list: (filters: PaymentMonitoringFilters) =>
    [...paymentMonitoringKeys.all, 'list', filters] as const,
}

export function usePaymentMonitoring(filters: PaymentMonitoringFilters, enabled = true) {
  return useQuery({
    queryKey: paymentMonitoringKeys.list(filters),
    queryFn: () => getPaymentMonitoring(filters),
    enabled,
    staleTime: 30_000,
  })
}
