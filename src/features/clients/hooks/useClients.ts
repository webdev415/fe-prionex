/**
 * React Query hooks for Client operations
 * TIN-based brand isolation architecture
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { clientApi } from '../api/clientApi'
import { paymentApi } from '../api/paymentApi'
import { taskApi } from '../api/taskApi'
import { interactionApi } from '../api/interactionApi'
import { callSmsApi } from '../api/callSmsApi'
import { documentApi } from '../api/documentApi'
import type {
  AssignClientRequest,
  BulkAssignClientRequest,
  CreateAddressRequest,
  CreateClientRequest,
  CreateContactRequest,
  CreateRestructuringAgreementRequest,
  GetClientsParams,
  ManualPriorityRequest,
  SearchByTinParams,
  UpdateAddressRequest,
  UpdateClientRequest,
  UpdateContactRequest,
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
  dialHistory: (id: number) => [...clientKeys.details(), id, 'dialHistory'] as const,
  restructuringAgreements: (id: number) =>
    [...clientKeys.details(), id, 'restructuringAgreements'] as const,
  restructuringDetail: (id: number, raId: number) =>
    [...clientKeys.details(), id, 'restructuringDetail', raId] as const,
  search: (params: SearchByTinParams) => [...clientKeys.all, 'search', params] as const,
  count: () => [...clientKeys.all, 'count'] as const,
  prioritySummary: () => [...clientKeys.all, 'priority-summary'] as const,
  contactTypes: () => [...clientKeys.all, 'contact-types'] as const,
}

/**
 * Get list of clients for user's active project
 * Auto-refetches every 60 seconds
 */
export function useClients(params: GetClientsParams = {}) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => clientApi.getClients(params),
    // Keep previous page/filter/sort results while refetching to avoid full-page loader flicker.
    placeholderData: (previousData) => previousData,
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
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateClientRequest }) =>
      clientApi.updateClient(id, data),
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

// --- Client detail: real API hooks ---

/**
 * Get client profile (header + left card). Calls GET /clients/{id}/profile
 */
export function useClientProfile(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.profile(clientId),
    queryFn: () => clientApi.getClientProfile(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 30000,
  })
}

/**
 * Get client loans/debts. Uses existing GET /clients/{id} which returns debts array.
 */
export function useClientLoans(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.loans(clientId),
    queryFn: () => clientApi.getClientById(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 30000,
    select: (data) => data.debts ?? [],
  })
}

/**
 * Get client payments section (payments + write-offs).
 * Fetches payment history and write-offs in parallel.
 */
export function useClientPaymentsSection(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.paymentsSection(clientId),
    queryFn: async () => {
      const [paymentsData, writeoffsData] = await Promise.all([
        paymentApi.getClientPayments(clientId),
        clientApi.getClientWriteoffs(clientId).catch(() => ({ writeoffs: [], total: 0 })),
      ])
      return {
        payments: paymentsData.payments,
        writesOffs: writeoffsData.writeoffs,
        // Phase 8: Payments to Primary Creditor kept as empty (no backend support yet)
        paymentsToPrimaryCreditor: [] as Array<Record<string, unknown>>,
      }
    },
    enabled: enabled && clientId > 0,
    staleTime: 30000,
  })
}

/**
 * Get client call/SMS history. Calls existing call and SMS service endpoints in parallel.
 * Maps backend responses to UI-expected shape for backward compatibility.
 */
export function useClientCallSmsHistory(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.callSmsHistory(clientId),
    queryFn: async () => {
      const [callsData, smsData] = await Promise.all([
        callSmsApi
          .getClientCalls(clientId, { limit: 10 })
          .catch(() => ({ calls: [] as never[], total: 0 })),
        callSmsApi
          .getClientSms(clientId, { limit: 10 })
          .catch(() => ({ messages: [] as never[], total: 0 })),
      ])

      // Map calls to UI shape
      const mappedCalls = (callsData.calls ?? []).map((c) => {
        const dt = c.initiated_at ? new Date(c.initiated_at) : new Date()
        const durationSecs = c.talk_duration ?? 0
        const durationMin = Math.floor(durationSecs / 60)
        const durationSec = durationSecs % 60
        return {
          id: c.call_id,
          call_id: c.call_id,
          date: dt.toISOString().split('T')[0],
          time: dt.toTimeString().slice(0, 5),
          phone: c.customer_number && c.customer_number !== 'unknown' ? c.customer_number : '-',
          phoneLabel: 'Primary',
          status: c.outcome ?? c.state ?? 'unknown',
          duration: durationSecs > 0 ? `${durationMin}m ${durationSec}s` : '-',
          operator: c.agent_extension && c.agent_extension !== '000' ? c.agent_extension : '-',
          cost: 0,
          type: 'Outgoing' as 'Outgoing' | 'Incoming',
          line: '',
          initiated_at: c.initiated_at ?? new Date().toISOString(),
          recording_path: c.recording_path ?? null,
        }
      })

      // Map SMS to UI shape
      const mappedSms = (smsData.messages ?? []).map((s) => {
        const dt = new Date(s.sent_at ?? s.created_at)
        // Access extended fields from API response
        const extendedSms = s as typeof s & { cost?: number; operator_name?: string | null }
        return {
          id: s.id,
          date: dt.toISOString().split('T')[0],
          time: dt.toTimeString().slice(0, 5),
          phone: s.phone_number ?? '',
          phoneLabel: 'Primary',
          status: s.status ?? 'unknown',
          template: s.template_name || null,
          message: s.content ?? '',
          operator: extendedSms.operator_name ?? '-',
          cost: extendedSms.cost ?? 0,
          sent_at: s.sent_at ?? s.created_at,
          delivered_at: s.delivered_at ?? null,
        }
      })

      // Merge and sort by date descending
      const all = [
        ...mappedCalls.map((c) => ({
          ...c,
          type: 'Call' as const,
          number: c.phone,
          itemType: 'call' as const,
        })),
        ...mappedSms.map((s) => ({
          ...s,
          type: 'SMS' as const,
          number: s.phone,
          itemType: 'sms' as const,
        })),
      ].sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`)
        const dateB = new Date(`${b.date}T${b.time}`)
        return dateB.getTime() - dateA.getTime()
      })

      return { calls: mappedCalls, sms: mappedSms, all }
    },
    enabled: enabled && clientId > 0,
    staleTime: 30000,
  })
}

/**
 * Get client tasks. Calls GET /tasks/client/{id}
 */
export function useClientTasks(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.tasks(clientId),
    queryFn: () => taskApi.getClientTasks(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 30000,
    refetchInterval: 30_000,
    select: (data) => data.tasks ?? [],
  })
}

/**
 * Update a task (status, priority, etc.)
 */
export function useUpdateTask(clientId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Record<string, unknown> }) =>
      taskApi.updateTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.tasks(clientId) })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
      toast.success('Task updated successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to update task'
      toast.error(message)
    },
  })
}

/**
 * Delete a task
 */
export function useDeleteTask(clientId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: number) => taskApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.tasks(clientId) })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
      toast.success('Task deleted successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to delete task'
      toast.error(message)
    },
  })
}

/**
 * Get client assignment history (operators + searchers). Calls GET /clients/{id}/assignment-history
 */
export function useClientOperatorsSection(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.operatorsSection(clientId),
    queryFn: async () => {
      const [employeeHistory, searcherHistory] = await Promise.all([
        clientApi.getClientAssignmentHistory(clientId, { assignment_type: 'employee' }),
        clientApi.getClientAssignmentHistory(clientId, { assignment_type: 'searcher' }),
      ])
      return {
        operators: employeeHistory.history,
        searchers: searcherHistory.history,
        current_employee: employeeHistory.current_employee,
        current_searcher: searcherHistory.current_searcher,
      }
    },
    enabled: enabled && clientId > 0,
    staleTime: 30000,
  })
}

/**
 * Get client documents from backend API.
 */
export function useClientDocuments(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.documents(clientId),
    queryFn: () => documentApi.list(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 60000,
  })
}

/**
 * Get client activities (interaction timeline). Calls GET /clients/{id}/interactions.
 * Returns only items (first page) — used by ClientDetailPage preview.
 */
export function useClientActivities(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.activities(clientId),
    queryFn: () => interactionApi.getClientInteractions(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 30000,
    select: (data) => data.items ?? [],
  })
}

/**
 * Get client activities with server-side pagination and filtering.
 * Returns full response { items, total, page, page_size }.
 * Used by ActivityTimelinePage.
 */
export function useClientActivitiesPaginated(
  clientId: number,
  params: {
    page?: number
    page_size?: number
    type_id?: number
    date_from?: string
    date_to?: string
    promise_date_from?: string
    promise_date_to?: string
    callback_date_from?: string
    callback_date_to?: string
    interaction_user_id?: number
    latest_only?: boolean
  } = {},
  enabled = true
) {
  return useQuery({
    queryKey: [...clientKeys.activities(clientId), 'paginated', params] as const,
    queryFn: () => interactionApi.getClientInteractions(clientId, params),
    enabled: enabled && clientId > 0,
    staleTime: 30000,
  })
}

/**
 * Add a phone number to spam call history for a client.
 */
export function useAddSpamCallHistory(clientId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (phone: string) => interactionApi.addSpamCallHistory(clientId, phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.dialHistory(clientId) })
      toast.success('Phone number added to spam call history')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error.response?.data?.detail || 'Failed to add to spam call history'
      toast.error(message)
    },
  })
}

/**
 * Get dial history for a client.
 */
export function useClientDialHistory(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.dialHistory(clientId),
    queryFn: () => interactionApi.getClientDialHistory(clientId, { limit: 10 }),
    enabled: enabled && clientId > 0,
    staleTime: 30000,
    select: (data) => data.records ?? [],
  })
}

/**
 * Get restructuring agreements for a client (RR tab).
 */
export function useClientRestructuringAgreements(clientId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.restructuringAgreements(clientId),
    queryFn: () => clientApi.getClientRestructuringAgreements(clientId),
    enabled: enabled && clientId > 0,
    staleTime: 30000,
  })
}

/**
 * Get restructuring agreement detail (RR modal).
 */
export function useRestructuringAgreementDetail(clientId: number, raId: number, enabled = true) {
  return useQuery({
    queryKey: clientKeys.restructuringDetail(clientId, raId),
    queryFn: () => clientApi.getRestructuringAgreementDetail(clientId, raId),
    enabled: enabled && clientId > 0 && raId > 0,
    staleTime: 30000,
  })
}

/**
 * Create a restructuring agreement for a client (Connect RR).
 */
export function useCreateRestructuringAgreement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      clientId,
      data,
    }: {
      clientId: number
      data: CreateRestructuringAgreementRequest
    }) => clientApi.createRestructuringAgreement(clientId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: clientKeys.restructuringAgreements(variables.clientId),
      })
    },
  })
}

/**
 * Close a debt (set status to 'closed').
 */
export function useCloseDebt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, debtId }: { clientId: number; debtId: number }) =>
      clientApi.closeDebt(clientId, debtId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.loans(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      toast.success('Loan closed successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to close loan'
      toast.error(message)
    },
  })
}

/**
 * Complete a restructuring agreement (set status_id to 4).
 */
export function useCompleteRestructuringAgreement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, raId }: { clientId: number; raId: number }) =>
      clientApi.completeRestructuringAgreement(clientId, raId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: clientKeys.restructuringAgreements(variables.clientId),
      })
      toast.success('Restructuring agreement completed')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to complete restructuring agreement'
      toast.error(message)
    },
  })
}

// --- Task mutations ---

/**
 * Create a new task for a client
 */
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof taskApi.createTask>[0]) => taskApi.createTask(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.tasks(variables.client_id) })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
      toast.success('Task created successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to create task'
      toast.error(message)
    },
  })
}

/**
 * Get past tasks assigned to the current user (bell notifications)
 */
export function useMyTasks() {
  return useQuery({
    queryKey: ['tasks', 'my-tasks'],
    queryFn: () => taskApi.getMyTasks(),
    refetchInterval: 30_000,
    staleTime: 15_000,
    select: (data) => data,
  })
}

/**
 * Get task subjects for dropdown
 */
export function useTaskSubjects() {
  return useQuery({
    queryKey: ['task-subjects'],
    queryFn: () => taskApi.getTaskSubjects(true),
    staleTime: 5 * 60_000,
    select: (data) => data.subjects ?? [],
  })
}

/**
 * Create a new interaction
 */
export function useCreateInteraction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof interactionApi.createInteraction>[0]) =>
      interactionApi.createInteraction(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(variables.client_id) })
      toast.success('Interaction recorded successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to record interaction'
      toast.error(message)
    },
  })
}

/**
 * Create address for a client
 */
export function useCreateAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: number; data: CreateAddressRequest }) =>
      clientApi.createAddress(clientId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.profile(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.clientId) })
    },
  })
}

/**
 * Update address for a client
 */
export function useUpdateAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      clientId,
      addressId,
      data,
    }: {
      clientId: number
      addressId: number
      data: UpdateAddressRequest
    }) => clientApi.updateAddress(clientId, addressId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.profile(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.clientId) })
    },
  })
}

/**
 * Delete address for a client
 */
export function useDeleteAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, addressId }: { clientId: number; addressId: number }) =>
      clientApi.deleteAddress(clientId, addressId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.profile(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.clientId) })
    },
  })
}

/**
 * Create contact for a client
 */
export function useCreateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: number; data: CreateContactRequest }) =>
      clientApi.createContact(clientId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.profile(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.clientId) })
    },
  })
}

/**
 * Update contact for a client
 */
export function useUpdateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      clientId,
      contactId,
      data,
    }: {
      clientId: number
      contactId: number
      data: UpdateContactRequest
    }) => clientApi.updateContact(clientId, contactId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.profile(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.clientId) })
    },
  })
}

/**
 * Delete contact for a client
 */
export function useDeleteContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, contactId }: { clientId: number; contactId: number }) =>
      clientApi.deleteContact(clientId, contactId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.profile(variables.clientId) })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.clientId) })
    },
  })
}

/**
 * Fetch contact type options from the lookup table
 */
export function useContactTypes() {
  return useQuery({
    queryKey: clientKeys.contactTypes(),
    queryFn: () => clientApi.getContactTypes(),
    staleTime: Infinity, // Lookup data rarely changes
  })
}

export function useUpdateEmployment() {
  return useMutation({
    mutationFn: ({
      clientId,
      data,
    }: {
      clientId: number
      data: import('../api/types').UpdateEmploymentRequest
    }) => clientApi.updateEmployment(clientId, data),
  })
}

export function useUpdatePassport() {
  return useMutation({
    mutationFn: ({
      clientId,
      data,
    }: {
      clientId: number
      data: import('../api/types').UpdatePassportRequest
    }) => clientApi.updatePassport(clientId, data),
  })
}
