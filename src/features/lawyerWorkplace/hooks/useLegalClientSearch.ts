import { useQuery } from '@tanstack/react-query'
import { searchClients, type SearchType } from '@/api/clientSearchApi'
import { useAuthStore } from '@/stores/authStore'
import type { LegalClientSearchResponse } from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'

function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  const first_name = parts[0] ?? ''
  const last_name = parts.slice(1).join(' ')
  return { first_name, last_name }
}

export function useLegalClientSearch(
  query: string,
  options?: { enabled?: boolean; searchType?: SearchType }
) {
  const trimmed = query.trim()
  const searchType = options?.searchType ?? 'name'
  const enabled = options?.enabled !== false && trimmed.length >= 2
  const activeProjectId = useAuthStore((state) => state.user?.active_project_id)

  return useQuery({
    queryKey: [
      ...legalWorkplaceKeys.all,
      'client-search',
      searchType,
      trimmed,
      activeProjectId,
    ] as const,
    queryFn: async (): Promise<LegalClientSearchResponse> => {
      const data = await searchClients({ q: trimmed, search_type: searchType, limit: 20 })
      return {
        items: data.items.map((item) => {
          const { first_name, last_name } = splitFullName(item.full_name)
          return {
            id: item.id,
            first_name,
            last_name,
            project_id: Number(activeProjectId ?? 0),
          }
        }),
      }
    },
    enabled,
    staleTime: 30_000,
  })
}
