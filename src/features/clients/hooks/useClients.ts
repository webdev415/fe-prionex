/**
 * React Query hooks for Client operations
 * TIN-based brand isolation architecture
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { clientApi } from '../api/clientApi'
import type {
  CreateClientRequest,
  GetClientsParams,
  ManualPriorityRequest,
  SearchByTinParams,
  UpdateClientRequest,
} from '../api/types'

// Query keys
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (params: GetClientsParams) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: number) => [...clientKeys.details(), id] as const,
  search: (params: SearchByTinParams) => [...clientKeys.all, 'search', params] as const,
  count: () => [...clientKeys.all, 'count'] as const,
}

/**
 * Get list of clients for user's active project
 * Auto-refetches every 60 seconds
 */
export function useClients(params: GetClientsParams = {}) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => clientApi.getClients(params),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every 60 seconds
    enabled: true,
  })
}

/**
 * Get single client by ID
 */
export function useClient(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: () => clientApi.getClientById(clientId),
    enabled: enabled && !!clientId,
    staleTime: 30000,
  })
}

/**
 * Search client by TIN
 * VERY FAST: < 10ms performance
 */
export function useSearchByTin(params: SearchByTinParams, enabled = false) {
  return useQuery({
    queryKey: clientKeys.search(params),
    queryFn: () => clientApi.searchByTin(params),
    enabled: enabled && !!params.tin,
    staleTime: 10000, // TIN search is very fast, can be stale quicker
  })
}

/**
 * Get total client count
 */
export function useClientCount() {
  return useQuery({
    queryKey: clientKeys.count(),
    queryFn: () => clientApi.getClientCount(),
    staleTime: 60000, // 1 minute
  })
}

/**
 * Create new client
 */
export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClientRequest) => clientApi.createClient(data),
    onSuccess: () => {
      // Invalidate and refetch clients list
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      queryClient.invalidateQueries({ queryKey: clientKeys.count() })
      toast.success('Client created successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to create client'
      toast.error(message)
    },
  })
}

/**
 * Update client
 */
export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateClientRequest }) =>
      clientApi.updateClient(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific client and lists
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      toast.success('Client updated successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to update client'
      toast.error(message)
    },
  })
}

/**
 * Delete client
 */
export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (clientId: number) => clientApi.deleteClient(clientId),
    onSuccess: () => {
      // Invalidate clients list and count
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      queryClient.invalidateQueries({ queryKey: clientKeys.count() })
      toast.success('Client deleted successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to delete client'
      toast.error(message)
    },
  })
}

/**
 * Set manual priority override
 * Requires Supervisor or Admin role
 */
export function useSetManualPriority() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: number; data: ManualPriorityRequest }) =>
      clientApi.setManualPriority(clientId, data),
    onSuccess: (_, variables) => {
      // Invalidate specific client and lists
      queryClient.invalidateQueries({
        queryKey: clientKeys.detail(variables.clientId),
      })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      toast.success('Manual priority set successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to set manual priority'
      toast.error(message)
    },
  })
}
