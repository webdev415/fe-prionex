/**
 * Dialer statistics hooks (KAN-379).
 *
 * Powers the supervisor Analysis tab (design: supervisor-07): live per-operator
 * stats and per-SIM stats. Both poll while the tab is open so the supervisor
 * sees near-real-time talk time / utilization.
 */

import { useQuery } from '@tanstack/react-query'

import { dialerService } from '../api/dialerService'
import type { OperatorDialerStats, SimCardStats } from '../types'

export interface DialerStatsFilters {
  queue_id?: number
  operator_id?: number
  date_from?: string
  date_to?: string
}

const LIVE_REFETCH_MS = 10_000

export const dialerStatsKeys = {
  all: ['dialerStats'] as const,
  operators: (filters: DialerStatsFilters) =>
    [...dialerStatsKeys.all, 'operators', filters] as const,
  sims: (queueId?: number) => [...dialerStatsKeys.all, 'sims', queueId ?? null] as const,
}

export function useOperatorStats(filters: DialerStatsFilters = {}) {
  return useQuery<OperatorDialerStats[]>({
    queryKey: dialerStatsKeys.operators(filters),
    queryFn: () => dialerService.getOperatorStats(filters),
    refetchInterval: LIVE_REFETCH_MS,
  })
}

export function useSimStats(queueId?: number) {
  return useQuery<SimCardStats[]>({
    queryKey: dialerStatsKeys.sims(queueId),
    queryFn: () => dialerService.getSimStats(queueId ? { queue_id: queueId } : undefined),
    refetchInterval: LIVE_REFETCH_MS,
  })
}
