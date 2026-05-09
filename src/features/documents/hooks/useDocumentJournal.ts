import { useQuery } from '@tanstack/react-query'
import { fetchDocumentJournal } from '../api/documentJournalApi'
import type { DocumentJournalParams } from '../api/types'

export const documentJournalKeys = {
  all: ['document-journal'] as const,
  list: (params: DocumentJournalParams) => [...documentJournalKeys.all, 'list', params] as const,
}

export function useDocumentJournal(
  params: DocumentJournalParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: documentJournalKeys.list(params),
    queryFn: () => fetchDocumentJournal(params),
    enabled: options?.enabled !== false,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
