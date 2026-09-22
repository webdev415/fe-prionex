import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import * as operatorPinsApi from '../api/operatorPinsApi'
import type { OperatorPinListResponse } from '../api/operatorPinsApi'

export const operatorPinKeys = {
  all: ['operator-pins'] as const,
}

// Hoisted so its reference stays stable across renders. An inline arrow here
// would defeat React Query's select memoization — the function reference is
// part of the memo key — and allocate a fresh Set every render, which then
// invalidates downstream useMemos that depend on the returned set.
const toPinnedSet = (data: OperatorPinListResponse) => new Set(data.operator_ids)

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
    // Pins change only when this user toggles one, and the toggles below keep
    // this cache in step themselves. A long window therefore costs nothing and
    // saves a request every time a client card mounts, which is every client an
    // operator opens.
    staleTime: 5 * 60 * 1000,
    select: toPinnedSet,
  })
}

/** Shared by pin and unpin, so each can see whether the other is still in flight. */
const PIN_TOGGLE_KEY = [...operatorPinKeys.all, 'toggle'] as const

const translate = (key: string, defaultValue: string) => i18n.t(key, { ns: 'common', defaultValue })

/** Move one operator in or out of whatever set is cached right now. */
function applyToggle(
  queryClient: ReturnType<typeof useQueryClient>,
  operatorId: number,
  pinned: boolean
) {
  queryClient.setQueryData<OperatorPinListResponse>(operatorPinKeys.all, (current) => {
    if (!current) return current
    const without = current.operator_ids.filter((id) => id !== operatorId)
    return { operator_ids: pinned ? [...without, operatorId] : without }
  })
}

/**
 * One toggle, applied optimistically.
 *
 * The row moves between PINNED and ALL EMPLOYEES the moment it is clicked, and
 * several toggles can be in flight at once. That shapes every step:
 *
 * - A failure undoes only its own operator on the CURRENT cache. Restoring a
 *   snapshot taken at click time would also wipe out any toggle made since.
 * - Responses are not written into the cache: an earlier request's answer can
 *   arrive after a later click and would put that row back where it was.
 * - Only the last toggle to settle refetches, so a burst of clicks ends in one
 *   read of the server's set instead of whichever response happened to be last.
 */
function usePinToggle(pinned: boolean) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: PIN_TOGGLE_KEY,
    mutationFn: (operatorId: number) =>
      pinned ? operatorPinsApi.pinOperator(operatorId) : operatorPinsApi.unpinOperator(operatorId),
    onMutate: async (operatorId) => {
      await queryClient.cancelQueries({ queryKey: operatorPinKeys.all, exact: true })
      applyToggle(queryClient, operatorId, pinned)
    },
    onError: (_error, operatorId) => {
      applyToggle(queryClient, operatorId, !pinned)
      toast.error(
        pinned
          ? translate('pages.clients.assignee.pinFailed', 'Could not pin this employee')
          : translate('pages.clients.assignee.unpinFailed', 'Could not unpin this employee')
      )
    },
    onSettled: () => {
      // Still counted while its own callbacks run, so 1 means "only me".
      if (queryClient.isMutating({ mutationKey: PIN_TOGGLE_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey: operatorPinKeys.all, exact: true })
      }
    },
  })
}

export function usePinOperator() {
  return usePinToggle(true)
}

export function useUnpinOperator() {
  return usePinToggle(false)
}
