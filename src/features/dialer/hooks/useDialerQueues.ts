/**
 * Dialer queue hooks (KAN-379).
 *
 * React Query wrappers over `dialerService` for the supervisor Queue List
 * (design: supervisor-01) and the add/edit/delete modals (supervisor-02/03).
 * Mirrors the documentTypes CRUD hook pattern: a query-key factory, a list
 * query, and create/update/delete/setActive mutations that invalidate the
 * list and surface a fallback error toast.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { dialerService } from '../api/dialerService'
import type { DialerQueue, PagedDialerQueues } from '../types'

export interface DialerQueuesFilters {
  department_id?: number
  active_only?: boolean
  q?: string
}

export interface DialerQueuesPagedFilters extends DialerQueuesFilters {
  page: number
  page_size: number
}

export const dialerQueuesKeys = {
  all: ['dialerQueues'] as const,
  lists: () => [...dialerQueuesKeys.all, 'list'] as const,
  list: (filters: DialerQueuesFilters) => [...dialerQueuesKeys.lists(), filters] as const,
  paged: (filters: DialerQueuesPagedFilters) =>
    [...dialerQueuesKeys.all, 'paged', filters] as const,
  details: () => [...dialerQueuesKeys.all, 'detail'] as const,
  detail: (id: number) => [...dialerQueuesKeys.details(), id] as const,
}

export function useDialerQueues(filters: DialerQueuesFilters = {}) {
  return useQuery<DialerQueue[]>({
    queryKey: dialerQueuesKeys.list(filters),
    queryFn: () => dialerService.listQueues(filters),
    staleTime: 60 * 1000,
  })
}

/**
 * Paginated Queue List for the supervisor table (server-side filter + search +
 * pagination). `placeholderData` keeps the previous page visible while the next
 * loads, avoiding a table flash on page/search changes.
 */
export function useDialerQueuesPaged(filters: DialerQueuesPagedFilters) {
  return useQuery<PagedDialerQueues>({
    queryKey: dialerQueuesKeys.paged(filters),
    queryFn: () => dialerService.listQueuesPaged(filters),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useCreateDialerQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<DialerQueue>) => dialerService.createQueue(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dialerQueuesKeys.all }),
    onError: (error: Error) => toast.error(error.message || 'Failed to create queue'),
  })
}

export function useUpdateDialerQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<DialerQueue> }) =>
      dialerService.updateQueue(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dialerQueuesKeys.all }),
    onError: (error: Error) => toast.error(error.message || 'Failed to update queue'),
  })
}

export function useDeleteDialerQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => dialerService.deleteQueue(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dialerQueuesKeys.all }),
    onError: (error: Error) => toast.error(error.message || 'Failed to delete queue'),
  })
}

export function useSetDialerQueueActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      dialerService.setQueueActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dialerQueuesKeys.all }),
    onError: (error: Error) => toast.error(error.message || 'Failed to update queue status'),
  })
}
