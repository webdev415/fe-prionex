import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { legalApi } from '../api/legalApi'
import { mapLegalKanbanItems } from '../api/kanbanMappers'
import { legalWorkplaceKeys, useLegalLawyers } from './useLegalInbox'
import { useLegalProfileTimezone } from './useLegalProfileTimezone'

export function useLegalKanban(options?: { enabled?: boolean; assignedToUserId?: number }) {
  const timezone = useLegalProfileTimezone()
  const { data: lawyersData } = useLegalLawyers({
    enabled: options?.enabled !== false,
    scopedToActiveProject: true,
  })
  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])

  const query = useQuery({
    queryKey: legalWorkplaceKeys.kanban(options?.assignedToUserId),
    queryFn: () =>
      legalApi.listKanban(
        options?.assignedToUserId != null
          ? { assigned_to_user_id: options.assignedToUserId }
          : undefined
      ),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const tasks = useMemo(
    () => mapLegalKanbanItems(query.data?.items ?? [], lawyers, timezone),
    [lawyers, query.data?.items, timezone]
  )

  return {
    ...query,
    tasks,
    total: query.data?.total ?? 0,
  }
}
