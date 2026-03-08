/**
 * Hooks for creating interactions via the Interaction service.
 *
 * Provides lookup data (types, channels, contact types, results)
 * and a mutation to create new interaction records.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { interactionApi } from '../api/interactionApi'
import { clientKeys } from './useClients'
import type { InteractionCreateData } from '@/pages/ClientManagement/components/AddNoteModal'

/**
 * Fetch all active interaction types (Incoming, Outgoing, Searching) — cached 5 min.
 */
export function useInteractionTypes() {
  return useQuery({
    queryKey: ['interaction-types'],
    queryFn: () => interactionApi.getInteractionTypes(),
    staleTime: 300000,
  })
}

/**
 * Fetch all active communication channels (Call, Messenger, Mail, Chat) — cached 5 min.
 */
export function useInteractionSubtypes() {
  return useQuery({
    queryKey: ['interaction-subtypes'],
    queryFn: () => interactionApi.getInteractionSubtypes(),
    staleTime: 300000,
  })
}

/**
 * Fetch all active contact types (Client, 3rd Person, Relative) — cached 5 min.
 */
export function useInteractionContactTypes() {
  return useQuery({
    queryKey: ['interaction-contact-types'],
    queryFn: () => interactionApi.getInteractionContactTypes(),
    staleTime: 300000,
  })
}

/**
 * Fetch results allowed for the given type + channel + contact_type combination.
 * When type_id is undefined, returns all active results.
 * Re-fetches whenever any of the three ids change.
 */
export function useInteractionResults(params?: {
  typeId?: number
  channelId?: number
  contactTypeId?: number
}) {
  return useQuery({
    queryKey: ['interaction-results', params?.typeId, params?.channelId, params?.contactTypeId],
    queryFn: () =>
      interactionApi.getInteractionResults(
        params?.typeId !== undefined
          ? {
              type_id: params.typeId,
              channel_id: params.channelId,
              contact_type_id: params.contactTypeId,
            }
          : undefined
      ),
    staleTime: 300000,
  })
}

/**
 * Create an interaction record.
 * Backend auto-derives direction and channel from type_id and subtype_id.
 */
export function useCreateInteraction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: InteractionCreateData }) => {
      return interactionApi.createInteraction({
        client_id: clientId,
        type_id: data.type_id,
        subtype_id: data.subtype_id,
        contact_type_id: data.contact_type_id,
        result_id: data.result_id,
        summary: data.summary,
        interaction_date: new Date().toISOString(),
        promise_to_pay_date: data.promise_to_pay_date,
        promise_to_pay_amount: data.promise_to_pay_amount,
        next_action_date: data.next_action_date,
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(variables.clientId) })
      toast.success('Interaction added successfully')
    },
    onError: (error: AxiosError<{ detail?: string | Array<{ msg: string }> }>) => {
      const detail = error?.response?.data?.detail
      let message = 'Failed to add interaction'
      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail.map((e) => e.msg).join('; ')
      }
      toast.error(message)
    },
  })
}

// Re-export for backwards compatibility
export const useCreateNoteInteraction = useCreateInteraction
