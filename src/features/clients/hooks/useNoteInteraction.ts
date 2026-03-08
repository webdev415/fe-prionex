/**
 * Hooks for creating interactions via the Interaction service.
 *
 * Provides lookup data (types, subtypes, results) and a mutation
 * to create new interaction records from the client detail page.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { interactionApi } from '../api/interactionApi'
import { clientKeys } from './useClients'
import type { InteractionCreateData } from '@/pages/ClientManagement/components/AddNoteModal'
import type { InteractionTypeResponse } from '../api/types'

/**
 * Fetch all active interaction types (cached 5 min).
 */
export function useInteractionTypes() {
  return useQuery({
    queryKey: ['interaction-types'],
    queryFn: () => interactionApi.getInteractionTypes(),
    staleTime: 300000,
  })
}

/**
 * Fetch all active interaction subtypes (cached 5 min).
 * Subtypes are shared across all types — no type_id filter.
 */
export function useInteractionSubtypes() {
  return useQuery({
    queryKey: ['interaction-subtypes'],
    queryFn: () => interactionApi.getInteractionSubtypes(),
    staleTime: 300000,
  })
}

/**
 * Fetch all active interaction results (cached 5 min).
 */
export function useInteractionResults() {
  return useQuery({
    queryKey: ['interaction-results'],
    queryFn: () => interactionApi.getInteractionResults(),
    staleTime: 300000,
  })
}

/**
 * Create an interaction record.
 *
 * Derives direction from the selected type and sets
 * channel='phone', status='completed' automatically.
 */
export function useCreateInteraction() {
  const queryClient = useQueryClient()
  const { data: types } = useInteractionTypes()

  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: InteractionCreateData }) => {
      const selectedType = types?.find((t: InteractionTypeResponse) => t.id === data.type_id)
      const direction = selectedType?.direction === 'inbound' ? 'inbound' : 'outbound'

      return interactionApi.createInteraction({
        client_id: clientId,
        type_id: data.type_id,
        subtype_id: data.subtype_id,
        result_id: data.result_id,
        direction,
        channel: 'phone',
        summary: data.summary,
        interaction_date: new Date().toISOString(),
        promise_to_pay_date: data.promise_to_pay_date,
        promise_to_pay_amount: data.promise_to_pay_amount,
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(variables.clientId) })
      toast.success('Interaction added successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to add interaction'
      toast.error(message)
    },
  })
}

// Re-export for backwards compatibility during transition
export const useCreateNoteInteraction = useCreateInteraction
