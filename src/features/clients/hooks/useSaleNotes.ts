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
    mutationFn: (noteId: number) => saleNotesApi.deleteSaleNote(noteId),
    onSuccess: () => {
      toast.success(t('pages.client.saleNotes.deleteSuccess', 'Comment deleted'))
      // We don't know which client this note was on from just the noteId,
      // so invalidate the whole tree. Cheap — server returns small lists.
      queryClient.invalidateQueries({ queryKey: saleNotesKeys.all })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
