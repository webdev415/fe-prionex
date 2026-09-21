/**
 * Operator dialer session hooks (KAN-379).
 *
 * Powers the operator's join/leave of a campaign queue (design: operator-01/02)
 * and exposes the operator's current session status (active / paused /
 * not_connected). The session is polled so the UI reflects auto-pauses that
 * happen server-side (e.g. the queue empties while joined).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'

import { dialerService } from '../api/dialerService'
import type { DialerSession } from '../types'

const SESSION_REFETCH_MS = 10_000

export const dialerSessionKeys = {
  all: ['dialerSession'] as const,
  me: () => [...dialerSessionKeys.all, 'me'] as const,
}

export function useMyDialerSession() {
  return useQuery<DialerSession>({
    queryKey: dialerSessionKeys.me(),
    queryFn: () => dialerService.getMySession(),
    refetchInterval: SESSION_REFETCH_MS,
  })
}

export function useJoinQueue() {
  const queryClient = useQueryClient()
  return useMutation<DialerSession, Error, { queueId: number; autoConnect: boolean }>({
    mutationFn: ({ queueId, autoConnect }) => dialerService.joinQueue(queueId, autoConnect),
    onSuccess: (session) => {
      queryClient.setQueryData(dialerSessionKeys.me(), session)
      queryClient.invalidateQueries({ queryKey: dialerSessionKeys.me() })
    },
    onError: (error) =>
      toast.error(
        error.message ||
          i18n.t('toasts.dialer.joinFailed', { defaultValue: 'Failed to join the dialer' })
      ),
  })
}

export function useLeaveQueue() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: () => dialerService.leaveQueue(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dialerSessionKeys.me() }),
    onError: (error) =>
      toast.error(
        error.message ||
          i18n.t('toasts.dialer.leaveFailed', { defaultValue: 'Failed to leave the dialer' })
      ),
  })
}
