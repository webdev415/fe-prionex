/**
 * React Query hooks for per-client sale-notes (KAN-617).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { saleNotesApi } from '../api/saleNotesApi'
import { getErrorMessage } from '@/lib/errors'

export const saleNotesKeys = {
  all: ['clientSaleNotes'] as const,
  byClient: (clientId: number) => [...saleNotesKeys.all, 'byClient', clientId] as const,
}

export function useSaleNotesList(clientId: number) {
  return useQuery({
    queryKey: saleNotesKeys.byClient(clientId),
    queryFn: () => saleNotesApi.getSaleNotes(clientId),
    enabled: !!clientId,
  })
}

export function useDeleteSaleNote() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('common')

  return useMutation({
    // Callers pass both noteId (for the DELETE call) and clientId (for
    // targeted cache invalidation). The DELETE response itself doesn't
    // include client_id, so we rely on the caller — which already knows
    // it from props on the per-client page.
    mutationFn: ({ noteId }: { noteId: number; clientId: number }) =>
      saleNotesApi.deleteSaleNote(noteId),
    onSuccess: (_data, { clientId }) => {
      toast.success(t('pages.client.saleNotes.deleteSuccess', 'Comment deleted'))
      // Targeted invalidation — only THIS client's cache. Other clients'
      // cached lists stay fresh, so navigating between clients doesn't
      // trigger unnecessary refetches.
      queryClient.invalidateQueries({ queryKey: saleNotesKeys.byClient(clientId) })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
