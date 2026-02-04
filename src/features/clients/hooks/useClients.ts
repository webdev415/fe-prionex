/**
 * React Query hooks for Client operations
 * TIN-based brand isolation architecture
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { clientApi } from '../api/clientApi'
import {
  getMockClientActivities,
  getMockClientCallSmsHistory,
  getMockClientDocuments,
  getMockClientLoans,
  getMockClientOperatorsSection,
  getMockClientPaymentsSection,
  getMockClientProfile,
  getMockClientTasks,
} from '../api/mockClientDetailApi'
import type {
  AssignClientRequest,
  BulkAssignClientRequest,
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
  profile: (id: number) => [...clientKeys.details(), id, 'profile'] as const,
  loans: (id: number) => [...clientKeys.details(), id, 'loans'] as const,
  paymentsSection: (id: number) => [...clientKeys.details(), id, 'payments'] as const,
  callSmsHistory: (id: number) => [...clientKeys.details(), id, 'callSmsHistory'] as const,
  tasks: (id: number) => [...clientKeys.details(), id, 'tasks'] as const,
  operatorsSection: (id: number) => [...clientKeys.details(), id, 'operators'] as const,
  documents: (id: number) => [...clientKeys.details(), id, 'documents'] as const,
  activities: (id: number) => [...clientKeys.details(), id, 'activities'] as const,
  search: (params: SearchByTinParams) => [...clientKeys.all, 'search', params] as const,
  count: () => [...clientKeys.all, 'count'] as const,
  prioritySummary: () => [...clientKeys.all, 'priority-summary'] as const,
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
      queryClient.invalidateQueries({ queryKey: clientKeys.prioritySummary() })
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
      queryClient.invalidateQueries({ queryKey: clientKeys.prioritySummary() })
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
      queryClient.invalidateQueries({ queryKey: clientKeys.prioritySummary() })
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
      queryClient.invalidateQueries({ queryKey: clientKeys.prioritySummary() })
      toast.success('Manual priority set successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to set manual priority'
      toast.error(message)
    },
  })
}

/**
 * Get priority summary with counts and total debt breakdown
 */
export function usePrioritySummary() {
  return useQuery({
    queryKey: clientKeys.prioritySummary(),
    queryFn: () => clientApi.getPrioritySummary(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every 60 seconds
    enabled: true,
  })
}

/**
 * Assign a client to an employee and/or searcher
 * Requires Admin or Supervisor role
 */
export function useAssignClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: number; data: AssignClientRequest }) =>
      clientApi.assignClient(clientId, data),
    onSuccess: (_, variables) => {
      // Invalidate specific client and lists to show updated assignments
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      toast.success('Client assigned successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to assign client'
      toast.error(message)
    },
  })
}

/**
 * Bulk assign multiple clients to an employee and/or searcher
 * Requires Admin or Supervisor role
 */
export function useBulkAssignClients() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkAssignClientRequest) => clientApi.bulkAssignClients(data),
    onSuccess: (result) => {
      // Invalidate clients list to show updated assignments
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })

      // Show appropriate success message
      if (result.failed_count === 0) {
        toast.success(`Successfully assigned ${result.assigned_count} clients`)
      } else {
        toast.warning(
          `Assigned ${result.assigned_count} clients, ${result.failed_count} failed. Check details.`
        )
      }
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to bulk assign clients'
      toast.error(message)
    },
  })
}

// --- Client detail (mock): one profile + section endpoints ---

/**
 * Get client profile (header + left card). Mock only.
 */
export function useClientProfile(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.profile(clientId),
    queryFn: () => getMockClientProfile(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}

/**
 * Get client loans. Mock only.
 */
export function useClientLoans(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.loans(clientId),
    queryFn: () => getMockClientLoans(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}

/**
 * Get client payments section (payments, writesOffs, paymentsToPrimaryCreditor). Mock only.
 */
export function useClientPaymentsSection(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.paymentsSection(clientId),
    queryFn: () => getMockClientPaymentsSection(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}

/**
 * Get client call/SMS history. Mock only.
 */
export function useClientCallSmsHistory(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.callSmsHistory(clientId),
    queryFn: () => getMockClientCallSmsHistory(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}

/**
 * Get client tasks. Mock only.
 */
export function useClientTasks(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.tasks(clientId),
    queryFn: () => getMockClientTasks(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}

/**
 * Get client operators section (operators, searchers). Mock only.
 */
export function useClientOperatorsSection(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.operatorsSection(clientId),
    queryFn: () => getMockClientOperatorsSection(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}

/**
 * Get client documents. Mock only.
 */
export function useClientDocuments(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.documents(clientId),
    queryFn: () => getMockClientDocuments(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}

/**
 * Get client activities (timeline). Mock only.
 */
export function useClientActivities(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.activities(clientId),
    queryFn: () => getMockClientActivities(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}
