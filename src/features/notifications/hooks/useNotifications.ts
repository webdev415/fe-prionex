import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { taskApi } from '@/features/clients/api/taskApi'

import * as notificationApi from '../api/notificationApi'
import type { NotificationListResponse } from '../types'

export function useNotifications(params?: {
  page?: number
  page_size?: number
  type?: string
  read?: boolean
  starred?: boolean
}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationApi.getNotifications(params ?? { page: 1, page_size: 50 }),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDismissNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.dismissNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// Optimistic-UI helper: flip starred on the notification across every
// cached ['notifications', ...] query variant, removing it from queries
// whose `starred` filter would now exclude it. Returns a snapshot keyed
// by query-key so onError can revert.
type Snapshot = Array<[readonly unknown[], NotificationListResponse | undefined]>

function applyOptimisticStarFlip(
  queryClient: ReturnType<typeof useQueryClient>,
  notificationId: string,
  nextStarred: boolean
): Snapshot {
  const snapshot: Snapshot = []
  const entries = queryClient.getQueriesData<NotificationListResponse>({
    queryKey: ['notifications'],
  })
  for (const [key, data] of entries) {
    snapshot.push([key, data])
    // Skip non-list-shaped cache entries (e.g. ['notifications', 'unread-count']
    // returns { total, by_type } with no `items` array). Without this guard
    // the optimistic update throws synchronously and the mutation never fires.
    if (!data || !Array.isArray(data.items)) continue
    // Drop the item from queries whose starred filter would now exclude
    // it (Tasks tab filters starred=false → drop newly-starred items;
    // Starred tab filters starred=true → drop newly-unstarred items).
    const params = (key[1] as { starred?: boolean } | undefined) ?? {}
    const filterStarred = params.starred
    if (filterStarred !== undefined && filterStarred !== nextStarred) {
      queryClient.setQueryData<NotificationListResponse>(key, {
        ...data,
        items: data.items.filter((n) => n.id !== notificationId),
      })
    } else {
      // Otherwise just update the flag on the item (so the Star icon
      // toggles even on queries that don't filter by starred).
      queryClient.setQueryData<NotificationListResponse>(key, {
        ...data,
        items: data.items.map((n) =>
          n.id === notificationId ? { ...n, starred: nextStarred } : n
        ),
      })
    }
  }
  return snapshot
}

function revertSnapshot(queryClient: ReturnType<typeof useQueryClient>, snapshot: Snapshot): void {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

export function useStarNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.starNotification(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      return { snapshot: applyOptimisticStarFlip(queryClient, notificationId, true) }
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) revertSnapshot(queryClient, context.snapshot)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useUnstarNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.unstarNotification(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      return { snapshot: applyOptimisticStarFlip(queryClient, notificationId, false) }
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) revertSnapshot(queryClient, context.snapshot)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// Optimistic-UI helper: drop the notification matching `taskId` from
// every cached ['notifications', ...] query. Used by Complete/Cancel
// actions on the bell since both transitively cause the notification
// to auto-dismiss on the next poll cycle (~15s). Without this, the
// card stays visibly stuck for up to 15s after the click.
function applyOptimisticDropByTaskId(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: number
): Snapshot {
  const snapshot: Snapshot = []
  const entries = queryClient.getQueriesData<NotificationListResponse>({
    queryKey: ['notifications'],
  })
  for (const [key, data] of entries) {
    snapshot.push([key, data])
    // Same guard as applyOptimisticStarFlip — skip ['notifications', 'unread-count']
    // and any other non-list cache entry to avoid throwing on data.items.
    if (!data || !Array.isArray(data.items)) continue
    queryClient.setQueryData<NotificationListResponse>(key, {
      ...data,
      items: data.items.filter((n) => n.metadata?.task_id !== taskId),
    })
  }
  return snapshot
}

// Bell-specific Complete / Cancel mutation. Differs from the
// client-detail page's useUpdateTask in two ways: (1) invalidates the
// ['notifications'] cache (not the per-client tasks cache), and (2)
// optimistically removes the card from the bell immediately so the
// operator doesn't see it stuck for the ~15s poller cycle.
export function useUpdateTaskFromBell() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: 'completed' | 'cancelled' }) =>
      taskApi.updateTask(taskId, { status }),
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      return { snapshot: applyOptimisticDropByTaskId(queryClient, taskId) }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) revertSnapshot(queryClient, context.snapshot)
    },
    // No onSettled invalidation: notification auto-dismissal runs on a
    // ~15s celery poller in notification-service, so an immediate refetch
    // after the task PUT would return the still-undismissed row and the
    // card would visibly reappear. The optimistic drop holds until the
    // natural 60s refetchInterval, by which point the poller has run.
  })
}
