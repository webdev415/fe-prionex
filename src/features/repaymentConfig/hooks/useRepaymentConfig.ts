import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getRepaymentRules,
  getRepaymentRulesHistory,
  updateRepaymentRules,
  type UpdateRepaymentRulesRequest,
} from '../api/repaymentConfigApi'

export const repaymentConfigKeys = {
  all: ['repayment-config'] as const,
  config: () => [...repaymentConfigKeys.all, 'config'] as const,
  history: (params?: object) => [...repaymentConfigKeys.all, 'history', params] as const,
}

export function useRepaymentConfig() {
  return useQuery({
    queryKey: repaymentConfigKeys.config(),
    queryFn: getRepaymentRules,
    staleTime: 30_000,
  })
}

export function useUpdateRepaymentConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: UpdateRepaymentRulesRequest) => updateRepaymentRules(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repaymentConfigKeys.all })
    },
  })
}

export function useRepaymentConfigHistory(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: repaymentConfigKeys.history(params),
    queryFn: () => getRepaymentRulesHistory(params),
    staleTime: 60_000,
  })
}
