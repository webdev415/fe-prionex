import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createScorecard,
  exportScorecards,
  getScorecard,
  getScorecardAggregate,
  getScorecardHistoryForCall,
  listMyScorecards,
  listScorecards,
  sendScorecard,
  updateScorecard,
} from '../api/qualityService'
import type {
  AggregateFilters,
  ScorecardCreatePayload,
  ScorecardListFilters,
  ScorecardUpdatePayload,
} from '../types'

export const scorecardKeys = {
  all: ['quality', 'scorecards'] as const,
  list: (filters: ScorecardListFilters) => [...scorecardKeys.all, 'list', filters] as const,
  myList: (filters: ScorecardListFilters) => [...scorecardKeys.all, 'me', filters] as const,
  detail: (scorecardId: number) => [...scorecardKeys.all, 'detail', scorecardId] as const,
  historyForCall: (callId: string) => [...scorecardKeys.all, 'history-for-call', callId] as const,
  aggregate: (filters: AggregateFilters) => [...scorecardKeys.all, 'aggregate', filters] as const,
}

export function useScorecardAggregate(filters: AggregateFilters, enabled = true) {
  return useQuery({
    queryKey: scorecardKeys.aggregate(filters),
    queryFn: () => getScorecardAggregate(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useScorecards(filters: ScorecardListFilters, enabled = true) {
  return useQuery({
    queryKey: scorecardKeys.list(filters),
    queryFn: () => listScorecards(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useMyScorecards(
  filters: Pick<ScorecardListFilters, 'period' | 'from_date' | 'to_date' | 'page' | 'page_size'>,
  enabled = true
) {
  return useQuery({
    queryKey: scorecardKeys.myList(filters as ScorecardListFilters),
    queryFn: () => listMyScorecards(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useScorecard(scorecardId: number | null, enabled = true) {
  return useQuery({
    queryKey:
      scorecardId == null
        ? ['quality', 'scorecards', 'detail', 'pending']
        : scorecardKeys.detail(scorecardId),
    queryFn: () => getScorecard(scorecardId as number),
    enabled: enabled && scorecardId != null,
    staleTime: 5_000,
  })
}

export function useScorecardHistoryForCall(callId: string | null, enabled = true) {
  return useQuery({
    queryKey:
      callId == null
        ? ['quality', 'scorecards', 'history-for-call', 'pending']
        : scorecardKeys.historyForCall(callId),
    queryFn: () => getScorecardHistoryForCall(callId as string),
    enabled: enabled && !!callId,
    staleTime: 30_000,
  })
}

export function useCreateScorecard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ScorecardCreatePayload) => createScorecard(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: scorecardKeys.all })
      queryClient.invalidateQueries({
        queryKey: scorecardKeys.historyForCall(created.call_id),
      })
    },
  })
}

export function useUpdateScorecard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      scorecardId,
      payload,
    }: {
      scorecardId: number
      payload: ScorecardUpdatePayload
    }) => updateScorecard(scorecardId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(scorecardKeys.detail(updated.id), updated)
      queryClient.invalidateQueries({ queryKey: scorecardKeys.all })
    },
  })
}

export function useSendScorecard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scorecardId: number) => sendScorecard(scorecardId),
    onSuccess: (sent) => {
      queryClient.setQueryData(scorecardKeys.detail(sent.id), sent)
      queryClient.invalidateQueries({ queryKey: scorecardKeys.all })
    },
  })
}

export function useExportScorecards() {
  return useMutation({
    mutationFn: (filters: ScorecardListFilters) => exportScorecards(filters),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `scorecards-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
  })
}
