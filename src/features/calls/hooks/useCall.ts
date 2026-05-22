import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { callService } from '../api/callService'
import type { OriginateCallRequest, CallHistoryFilters, UpdateCallOutcomeRequest } from '../types'
import { invalidateCallRelatedQueries } from '../utils/queryInvalidation'

export function useOriginateCall() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: OriginateCallRequest) => callService.originateCall(request),
    onSuccess: (_, variables) => {
      toast.success('Call initiated successfully')
      invalidateCallRelatedQueries(queryClient, variables.client_id)
    },
    onError: (_error: unknown) => {
      // Error handling is done in the component via onError callback
      // The component extracts the error message from the mutation error
    },
  })
}

export function useCallDetails(callId: string | null) {
  return useQuery({
    queryKey: ['callDetails', callId],
    queryFn: () => callService.getCallDetails(callId!),
    enabled: !!callId,
    refetchInterval: 2000, // Poll every 2 seconds during active call
  })
}

/**
 * Non-polling variant of useCallDetails. Designed for the deep-link case
 * (e.g. opening Action Analysis with `?call_id=…` for a call that's outside
 * the current filter window) — completed calls don't change, so a 5-minute
 * staleTime is plenty.
 */
export function useCallDetail(callId: string | null) {
  return useQuery({
    queryKey: ['callDetails', callId],
    queryFn: () => callService.getCallDetails(callId!),
    enabled: !!callId,
    staleTime: 5 * 60_000,
  })
}

export function useCallHistory(clientId: number | null, filters?: CallHistoryFilters) {
  return useQuery({
    queryKey: ['callHistory', clientId, filters],
    queryFn: () => callService.getCallHistory(clientId!, filters),
    enabled: !!clientId,
  })
}

export function useUpdateCallOutcome() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ callId, outcome }: { callId: string; outcome: UpdateCallOutcomeRequest }) =>
      callService.updateCallOutcome(callId, outcome),
    onSuccess: () => {
      toast.success('Call outcome saved')
      queryClient.invalidateQueries({ queryKey: ['callDetails'] })
      invalidateCallRelatedQueries(queryClient)
    },
    onError: () => {
      toast.error('Failed to save call outcome')
    },
  })
}

export function useAMIHealth() {
  return useQuery({
    queryKey: ['amiHealth'],
    queryFn: () => callService.getAMIHealth(),
    refetchInterval: 30000, // Check every 30 seconds
  })
}

export function useHangupCall() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (callId: string) => callService.hangupCall(callId),
    onSuccess: () => {
      toast.success('Call ended')
      queryClient.invalidateQueries({ queryKey: ['callDetails'] })
      invalidateCallRelatedQueries(queryClient)
    },
    onError: () => {
      toast.error('Failed to end call')
      invalidateCallRelatedQueries(queryClient)
    },
  })
}
