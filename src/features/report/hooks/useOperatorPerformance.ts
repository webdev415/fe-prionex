/**
 * Operator Performance Hook
 *
 * React Query hook for fetching operator performance data.
 */

import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'
import type { OperatorPerformanceParams } from '../api/types'
import {
  transformOperatorPerformance,
  transformToAgentPerformanceRows,
} from '../utils/transformers'
import type { OperatorPerformanceResponseUI } from '../types'

/**
 * Query keys for operator performance
 */
export const operatorPerformanceKeys = {
  all: ['reports', 'operator-performance'] as const,
  byProject: (projectId: number) => [...operatorPerformanceKeys.all, projectId] as const,
  byParams: (params: OperatorPerformanceParams) =>
    [...operatorPerformanceKeys.all, params] as const,
}

/**
 * Operator performance hook params
 */
export interface UseOperatorPerformanceParams {
  projectId: number
  operatorId?: number
  fromDate?: string
  toDate?: string
  enabled?: boolean
}

/**
 * Hook for fetching operator performance data
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useOperatorPerformance({
 *   projectId: 1,
 * })
 *
 * // For specific operator
 * const { data } = useOperatorPerformance({
 *   projectId: 1,
 *   operatorId: 5,
 * })
 * ```
 */
export function useOperatorPerformance({
  projectId,
  operatorId,
  fromDate,
  toDate,
  enabled = true,
}: UseOperatorPerformanceParams) {
  const backendParams: OperatorPerformanceParams = {
    project_id: projectId,
    operator_id: operatorId,
    from_date: fromDate,
    to_date: toDate,
  }

  return useQuery<OperatorPerformanceResponseUI>({
    queryKey: operatorPerformanceKeys.byParams(backendParams),
    queryFn: async () => {
      const data = await reportApi.getOperatorPerformance(backendParams)
      return transformOperatorPerformance(data)
    },
    enabled: enabled && !!projectId,
    staleTime: 60000,
    refetchInterval: 300000,
    retry: 2,
  })
}

/**
 * Hook that returns operator performance formatted for AgentPerformanceTable
 *
 * @example
 * ```tsx
 * const { data: agentPerformance, isLoading } = useAgentPerformanceTable({
 *   projectId: 1,
 * })
 *
 * return <AgentPerformanceTable data={agentPerformance || []} />
 * ```
 */
export function useAgentPerformanceTable(params: UseOperatorPerformanceParams) {
  const query = useOperatorPerformance(params)

  return {
    ...query,
    data: query.data ? transformToAgentPerformanceRows(query.data.operators) : undefined,
  }
}

/**
 * Hook for fetching single operator's performance
 */
export function useSingleOperatorPerformance({
  projectId,
  operatorId,
  fromDate,
  toDate,
  enabled = true,
}: Required<Pick<UseOperatorPerformanceParams, 'operatorId'>> & UseOperatorPerformanceParams) {
  const query = useOperatorPerformance({
    projectId,
    operatorId,
    fromDate,
    toDate,
    enabled: enabled && !!operatorId,
  })

  return {
    ...query,
    data: query.data?.operators[0],
  }
}
