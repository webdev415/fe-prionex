/**
 * React Query hooks for the global IP whitelist.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createIpWhitelistEntry,
  deleteIpWhitelistEntry,
  listIpWhitelist,
  updateIpWhitelistEntry,
} from './api'
import type { IpWhitelistCreateInput, IpWhitelistUpdateInput } from './types'

export const ipWhitelistKeys = {
  all: ['ipWhitelist'] as const,
  list: () => [...ipWhitelistKeys.all, 'list'] as const,
}

export function useIpWhitelist() {
  return useQuery({
    queryKey: ipWhitelistKeys.list(),
    queryFn: listIpWhitelist,
  })
}

export function useCreateIpWhitelistEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: IpWhitelistCreateInput) => createIpWhitelistEntry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ipWhitelistKeys.list() })
    },
  })
}

export function useUpdateIpWhitelistEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: IpWhitelistUpdateInput }) =>
      updateIpWhitelistEntry(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ipWhitelistKeys.list() })
    },
  })
}

export function useDeleteIpWhitelistEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entryId: number) => deleteIpWhitelistEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ipWhitelistKeys.list() })
    },
  })
}
