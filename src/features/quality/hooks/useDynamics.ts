import { useMutation, useQuery } from '@tanstack/react-query'
import {
  exportOperatorDynamics,
  getOperatorDynamics,
  listDynamicsAlerts,
} from '../api/qualityService'
import type { DynamicsAlertType, DynamicsFilters } from '../types'

export const dynamicsKeys = {
  all: ['quality', 'dynamics'] as const,
  detail: (filters: DynamicsFilters) => [...dynamicsKeys.all, 'detail', filters] as const,
  alerts: (opts: object) => [...dynamicsKeys.all, 'alerts', opts] as const,
}

export function useOperatorDynamics(filters: DynamicsFilters, enabled = true) {
  return useQuery({
    queryKey: dynamicsKeys.detail(filters),
    queryFn: () => getOperatorDynamics(filters),
    enabled: enabled && Number.isFinite(filters.operator_id),
    staleTime: 60_000,
  })
}

export function useDynamicsAlerts(
  opts: { operator_id?: number; alert_type?: DynamicsAlertType; limit?: number } = {},
  enabled = true
) {
  return useQuery({
    queryKey: dynamicsKeys.alerts(opts),
    queryFn: () => listDynamicsAlerts(opts),
    enabled,
    staleTime: 60_000,
  })
}

export function useExportOperatorDynamics() {
  return useMutation({
    mutationFn: (filters: DynamicsFilters) => exportOperatorDynamics(filters),
    onSuccess: (blob, filters) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dynamics-operator-${filters.operator_id}-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
  })
}
