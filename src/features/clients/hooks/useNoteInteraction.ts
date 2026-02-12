/**
 * Hooks for creating note-type interactions via the Interaction service.
 *
 * Replaces the deprecated client note API (POST /clients/{id}/notes)
 * with the unified interaction API (POST /interactions/).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { interactionApi } from '../api/interactionApi'
import { clientKeys } from './useClients'
import type { NoteCreateData } from '@/pages/ClientManagement/components/AddNoteModal'

/**
 * Fetch the 'note' interaction type and its subtypes.
 * Caches aggressively (5 min) since types rarely change.
 */
export function useNoteInteractionTypes() {
  const typesQuery = useQuery({
    queryKey: ['interaction-types', 'note'],
    queryFn: () => interactionApi.getInteractionTypes(true),
    staleTime: 300000,
    select: (data) => data.types.find((t) => t.code === 'note') ?? null,
  })

  const noteTypeId = typesQuery.data?.id ?? null

  const subtypesQuery = useQuery({
    queryKey: ['interaction-subtypes', noteTypeId],
    queryFn: () => interactionApi.getInteractionSubtypes(noteTypeId!, true),
    enabled: !!noteTypeId,
    staleTime: 300000,
    select: (data) => data.subtypes ?? [],
  })

  return {
    noteTypeId,
    subtypes: subtypesQuery.data ?? [],
    isLoading: typesQuery.isLoading || subtypesQuery.isLoading,
  }
}

/**
 * Create a note interaction.
 *
 * Maps AddNoteModal's NoteCreateData to the interaction API shape:
 * - content    -> notes
 * - note_type  -> subtype_id (resolved from 'note' type subtypes)
 * - related_*  -> corresponding interaction fields
 */
export function useCreateNoteInteraction() {
  const queryClient = useQueryClient()
  const { noteTypeId, subtypes } = useNoteInteractionTypes()

  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: NoteCreateData }) => {
      if (!noteTypeId) {
        throw new Error('Note interaction type not configured')
      }

      const subtype = data.note_type ? subtypes.find((s) => s.code === data.note_type) : undefined

      return interactionApi.createInteraction({
        client_id: clientId,
        type_id: noteTypeId,
        direction: 'outbound',
        channel: 'note',
        subtype_id: subtype?.id,
        notes: data.content,
        summary: `Note: ${data.note_type ?? 'general'}`,
        interaction_date: new Date().toISOString(),
        related_call_id: data.related_call_id,
        related_payment_id: data.related_payment_id,
        debt_id: data.related_debt_id,
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(variables.clientId) })
      toast.success('Note added successfully')
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error?.response?.data?.detail || 'Failed to add note'
      toast.error(message)
    },
  })
}
