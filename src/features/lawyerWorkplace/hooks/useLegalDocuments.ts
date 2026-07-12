import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useClients } from '@/features/clients/hooks/useClients'
import type { LegalDocumentTypeFilter } from '@/pages/LawyerWorkplace/documents/types'
import { legalApi } from '../api/legalApi'
import {
  buildLegalDocumentLookup,
  mapLegalDocumentItem,
  mapLegalDocumentStats,
} from '../api/documentMappers'
import type { LegalDocumentListParams } from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'
import { useLegalLawyers } from './useLegalInbox'

const EMPTY_FILTER_COUNTS: Record<LegalDocumentTypeFilter, number> = {
  all: 0,
  incoming: 0,
  outgoing: 0,
  nbu_response: 0,
  uploaded: 0,
  generated: 0,
}

export function useLegalDocuments(
  params: LegalDocumentListParams,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled !== false
  const { data: clientsData } = useClients({ limit: 500 }, { enabled })
  const { data: lawyersData } = useLegalLawyers({ enabled, scopedToActiveProject: true })

  const lookup = useMemo(
    () => buildLegalDocumentLookup(clientsData?.items ?? [], lawyersData?.items ?? []),
    [clientsData?.items, lawyersData?.items]
  )

  const query = useQuery({
    queryKey: legalWorkplaceKeys.documentsList(params),
    queryFn: () => legalApi.listDocuments(params),
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  })

  const documents = useMemo(
    () => (query.data?.items ?? []).map((item) => mapLegalDocumentItem(item, lookup)),
    [lookup, query.data?.items]
  )

  return {
    ...query,
    documents,
    total: query.data?.total ?? 0,
    page: query.data?.page ?? params.page ?? 1,
    pageSize: query.data?.page_size ?? params.page_size ?? 20,
  }
}

export function useLegalDocumentStats(options?: { enabled?: boolean; year?: number }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.documentStats(options?.year),
    queryFn: () => legalApi.getDocumentStats(options?.year != null ? { year: options.year } : {}),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    select: mapLegalDocumentStats,
  })
}

export function useLegalDocumentFilterCounts(options?: { enabled?: boolean }) {
  const statsQuery = useLegalDocumentStats({ enabled: options?.enabled !== false })

  return {
    ...statsQuery,
    data: statsQuery.data?.filterCounts ?? EMPTY_FILTER_COUNTS,
  }
}
