import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bulkDismissFlags,
  confirmFlag,
  convertFlagToTask,
  dismissFlag,
  getUnreviewedCount,
  listAutoFlagRules,
  listFlags,
  updateAutoFlagRule,
} from '../api/autoFlagsService'
import type {
  AutoFlagRuleUpdatePayload,
  FlagEventBulkDismissPayload,
  FlagEventConvertToTaskPayload,
  FlagEventDismissPayload,
  FlagEventListFilters,
} from '../types/autoFlags'

export const autoFlagsKeys = {
  all: ['training', 'auto-flags'] as const,
  list: (filters: FlagEventListFilters) => [...autoFlagsKeys.all, 'list', filters] as const,
  unreviewedCount: () => [...autoFlagsKeys.all, 'unreviewed-count'] as const,
  rules: () => [...autoFlagsKeys.all, 'rules'] as const,
}

export function useFlags(filters: FlagEventListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: autoFlagsKeys.list(filters),
    queryFn: () => listFlags(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useUnreviewedFlagsCount(enabled = true) {
  return useQuery({
    queryKey: autoFlagsKeys.unreviewedCount(),
    queryFn: () => getUnreviewedCount(),
    enabled,
    // Drives the sidebar badge — refresh every 60s per plan §4.3.
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useAutoFlagRules(enabled = true) {
  return useQuery({
    queryKey: autoFlagsKeys.rules(),
    queryFn: () => listAutoFlagRules(),
    enabled,
    staleTime: 5 * 60_000,
  })
}

function invalidateFlags(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: autoFlagsKeys.all })
}

export function useConfirmFlag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (flagId: number) => confirmFlag(flagId),
    onSuccess: () => invalidateFlags(queryClient),
  })
}

export function useDismissFlag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ flagId, payload }: { flagId: number; payload?: FlagEventDismissPayload }) =>
      dismissFlag(flagId, payload),
    onSuccess: () => invalidateFlags(queryClient),
  })
}

export function useBulkDismissFlags() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: FlagEventBulkDismissPayload) => bulkDismissFlags(payload),
    onSuccess: () => invalidateFlags(queryClient),
  })
}

export function useConvertFlagToTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      flagId,
      payload,
    }: {
      flagId: number
      payload?: FlagEventConvertToTaskPayload
    }) => convertFlagToTask(flagId, payload),
    onSuccess: () => {
      invalidateFlags(queryClient)
      // Correction tasks list also picks up the new row.
      queryClient.invalidateQueries({ queryKey: ['training', 'correction'] })
    },
  })
}

export function useUpdateAutoFlagRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ruleId, payload }: { ruleId: number; payload: AutoFlagRuleUpdatePayload }) =>
      updateAutoFlagRule(ruleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: autoFlagsKeys.rules() })
    },
  })
}
