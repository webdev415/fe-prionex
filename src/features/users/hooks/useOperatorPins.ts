import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as operatorPinsApi from '../api/operatorPinsApi'
import type { OperatorPinListResponse } from '../api/operatorPinsApi'

export const operatorPinKeys = {
  all: ['operator-pins'] as const,
}

/**
 * The operators this user pinned, as a Set so each row is an O(1) lookup.
 *
 * `enabled` lets a caller hold the request back until the picker that needs it
 * is actually open, the same way the operators list is gated — a popover that
 * may never be opened should not fetch on mount.
 */
export function useOperatorPins(enabled = true) {
  return useQuery({
    queryKey: operatorPinKeys.all,
    queryFn: operatorPinsApi.getOperatorPins,
    enabled,
    // Pins change only when this user toggles one, and both mutations below
    // write the server's answer straight into this cache. A long window
    // therefore costs nothing and saves a request every time a client card
    // mounts, which is every client an operator opens.
    staleTime: 5 * 60 * 1000,
    select: (data) => new Set(data.operator_ids),
  })
}

/**
 * Optimistically move `operatorId` in or out of the cached set.
 *
 * Shared by both mutations because the requirement is that the row jumps
 * between the PINNED and ALL EMPLOYEES sections without the popover closing or
 * flickering. Waiting for the round trip would leave the row visibly lagging
 * the click; the server's authoritative set replaces this in `onSuccess`.
 */
function optimisticPinToggle(
  queryClient: ReturnType<typeof useQueryClient>,
  next: (ids: number[]) => number[]
) {
  const previous = queryClient.getQueryData<OperatorPinListResponse>(operatorPinKeys.all)
  if (previous) {
    queryClient.setQueryData<OperatorPinListResponse>(operatorPinKeys.all, {
      operator_ids: next(previous.operator_ids),
    })
  }
  return { previous }
}

export function usePinOperator() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (operatorId: number) => operatorPinsApi.pinOperator(operatorId),
    onMutate: async (operatorId) => {
      await queryClient.cancelQueries({ queryKey: operatorPinKeys.all })
      return optimisticPinToggle(queryClient, (ids) =>
        ids.includes(operatorId) ? ids : [...ids, operatorId]
      )
    },
    onError: (_error, _operatorId, context) => {
      // Put the old set back, so a failed pin does not leave the row sitting in
      // a section the server never agreed to.
      if (context?.previous) {
        queryClient.setQueryData(operatorPinKeys.all, context.previous)
      }
    },
    onSuccess: (data) => {
      // The endpoint answers with the whole set, so this needs no refetch —
      // which matters because a refetch would land under an open popover.
      queryClient.setQueryData(operatorPinKeys.all, data)
    },
  })
}

export function useUnpinOperator() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (operatorId: number) => operatorPinsApi.unpinOperator(operatorId),
    onMutate: async (operatorId) => {
      await queryClient.cancelQueries({ queryKey: operatorPinKeys.all })
      return optimisticPinToggle(queryClient, (ids) => ids.filter((id) => id !== operatorId))
    },
    onError: (_error, _operatorId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(operatorPinKeys.all, context.previous)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(operatorPinKeys.all, data)
    },
  })
}
