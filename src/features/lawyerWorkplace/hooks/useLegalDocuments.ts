import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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

const FILTER_TYPES: LegalDocumentTypeFilter[] = [
  'all',
  'incoming',
  'outgoing',
  'nbu_response',
  'uploaded',
  'generated',
]

export function useLegalDocuments(
  params: LegalDocumentListParams,
  options?: { enabled?: boolean }
) {
  const { data: clientsData } = useClients({ limit: 500 }, { enabled: options?.enabled !== false })
  const { data: lawyersData } = useLegalLawyers({ enabled: options?.enabled !== false })

  const lookup = useMemo(
    () => buildLegalDocumentLookup(clientsData?.items ?? [], lawyersData?.items ?? []),
    [clientsData?.items, lawyersData?.items]
  )

  const query = useQuery({
    queryKey: legalWorkplaceKeys.documentsList(params),
    queryFn: () => legalApi.listDocuments(params),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
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
  return useQuery({
    queryKey: legalWorkplaceKeys.documentFilterCounts(),
    queryFn: async () => {
      const results = await Promise.all(
        FILTER_TYPES.map((typeFilter) =>
          legalApi.listDocuments({ page: 1, page_size: 1, type_filter: typeFilter })
        )
      )
      return FILTER_TYPES.reduce(
        (counts, typeFilter, index) => {
          counts[typeFilter] = results[index]?.total ?? 0
          return counts
        },
        {} as Record<LegalDocumentTypeFilter, number>
      )
    },
    enabled: options?.enabled !== false,
    staleTime: 30_000,
  })
}
