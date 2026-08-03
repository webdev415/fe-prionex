/**
 * React Query hook for listing factoring agreements (global).
 * Backs the Bulk Document Import agreement dropdown.
 */

import { useQuery } from '@tanstack/react-query'
import { factoringAgreementsApi } from '../api/factoringAgreementsApi'
import type { FactoringAgreementPage, ListFactoringAgreementsParams } from '../types'

export const factoringAgreementsKeys = {
  all: ['factoringAgreements'] as const,
  lists: () => [...factoringAgreementsKeys.all, 'list'] as const,
  list: (params: ListFactoringAgreementsParams) =>
    [...factoringAgreementsKeys.lists(), params] as const,
}

export function useFactoringAgreements(params: ListFactoringAgreementsParams = {}) {
  return useQuery<FactoringAgreementPage>({
    queryKey: factoringAgreementsKeys.list(params),
    queryFn: () => factoringAgreementsApi.list(params),
    staleTime: 5 * 60 * 1000,
  })
}
