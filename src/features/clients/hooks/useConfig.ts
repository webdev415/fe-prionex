/**
 * React Query hooks for system configuration
 */

import { useQuery } from '@tanstack/react-query'
import { configApi } from '../api/configApi'

/**
 * Query keys for configuration
 */
export const configKeys = {
  all: ['config'] as const,
  system: () => [...configKeys.all, 'system'] as const,
  priorityThresholds: () => [...configKeys.all, 'priority-thresholds'] as const,
}

/**
 * Hook to fetch system configuration
 *
 * Includes priority thresholds, TIN format rules, version info.
 * Configuration is cached for 1 hour.
 */
export function useSystemConfig() {
  return useQuery({
    queryKey: configKeys.system(),
    queryFn: configApi.getSystemConfig,
    staleTime: 60 * 60 * 1000, // 1 hour (config changes infrequently)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  })
}

/**
 * Hook to fetch priority score thresholds
 *
 * Returns thresholds for mapping priority_score to display priority.
 * Cached for 1 hour.
 */
export function usePriorityThresholds() {
  return useQuery({
    queryKey: configKeys.priorityThresholds(),
    queryFn: configApi.getPriorityThresholds,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  })
}
