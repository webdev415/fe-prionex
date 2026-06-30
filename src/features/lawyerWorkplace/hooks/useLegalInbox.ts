import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { IncomingFolder, IncomingMailboxFilter } from '@/pages/LawyerWorkplace/types'
import { legalApi } from '../api/legalApi'
import {
  buildLegalLookupContext,
  filterInboxByMailboxTab,
  mapInboxItemToLetterListItem,
} from '../api/mappers'
import type { LegalInboxItem, LegalInboxParams } from '../api/types'

export const legalWorkplaceKeys = {
  all: ['lawyer-workplace'] as const,
  inbox: () => [...legalWorkplaceKeys.all, 'inbox'] as const,
  inboxList: (params: LegalInboxParams) => [...legalWorkplaceKeys.inbox(), params] as const,
  messages: () => [...legalWorkplaceKeys.all, 'messages'] as const,
  message: (messageId: string) => [...legalWorkplaceKeys.messages(), messageId] as const,
  threads: () => [...legalWorkplaceKeys.all, 'threads'] as const,
  thread: (threadId: string, includeQuarantined?: boolean) =>
    [...legalWorkplaceKeys.threads(), threadId, { includeQuarantined }] as const,
  settings: () => [...legalWorkplaceKeys.all, 'settings'] as const,
  letterTypes: (includeInactive?: boolean) =>
    [...legalWorkplaceKeys.settings(), 'letter-types', { includeInactive }] as const,
  letterType: (letterTypeId: string) =>
    [...legalWorkplaceKeys.settings(), 'letter-type', letterTypeId] as const,
  lawyers: (includeInactive?: boolean) =>
    [...legalWorkplaceKeys.settings(), 'lawyers', { includeInactive }] as const,
  lawyer: (lawyerId: string) => [...legalWorkplaceKeys.settings(), 'lawyer', lawyerId] as const,
  trainingExamples: (letterTypeId: string) =>
    [...legalWorkplaceKeys.settings(), 'training-examples', letterTypeId] as const,
} as const

export function useLegalInbox(params: LegalInboxParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.inboxList(params),
    queryFn: () => legalApi.listInbox(params),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}

export function useLegalMessage(messageId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.message(messageId ?? ''),
    queryFn: () => legalApi.getMessage(messageId!),
    enabled: options?.enabled !== false && Boolean(messageId),
    staleTime: 10_000,
  })
}

export function useLegalThread(
  threadId: string | null,
  options?: { enabled?: boolean; includeQuarantined?: boolean }
) {
  const includeQuarantined = options?.includeQuarantined ?? false
  return useQuery({
    queryKey: legalWorkplaceKeys.thread(threadId ?? '', includeQuarantined),
    queryFn: () =>
      legalApi.getThread(threadId!, {
        include_quarantined: includeQuarantined,
      }),
    enabled: options?.enabled !== false && Boolean(threadId),
    staleTime: 10_000,
  })
}

export function useLegalLetterTypes(options?: { enabled?: boolean; includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false
  return useQuery({
    queryKey: legalWorkplaceKeys.letterTypes(includeInactive),
    queryFn: () => legalApi.listLetterTypes({ include_inactive: includeInactive }),
    enabled: options?.enabled !== false,
    staleTime: 60_000,
  })
}

export function useLegalLetterType(letterTypeId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.letterType(letterTypeId ?? ''),
    queryFn: () => legalApi.getLetterType(letterTypeId!),
    enabled: options?.enabled !== false && Boolean(letterTypeId),
    staleTime: 60_000,
  })
}

export function useLegalLawyers(options?: { enabled?: boolean; includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false
  return useQuery({
    queryKey: legalWorkplaceKeys.lawyers(includeInactive),
    queryFn: () => legalApi.listLawyers({ include_inactive: includeInactive }),
    enabled: options?.enabled !== false,
    staleTime: 60_000,
  })
}

export function useLegalLawyer(lawyerId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.lawyer(lawyerId ?? ''),
    queryFn: () => legalApi.getLawyer(lawyerId!),
    enabled: options?.enabled !== false && Boolean(lawyerId),
    staleTime: 60_000,
  })
}

export function useLegalTrainingExamples(
  letterTypeId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: legalWorkplaceKeys.trainingExamples(letterTypeId ?? ''),
    queryFn: () => legalApi.listTrainingExamples(letterTypeId!),
    enabled: options?.enabled !== false && Boolean(letterTypeId),
    staleTime: 60_000,
  })
}

function filterInboxByFolder(items: LegalInboxItem[], folder: IncomingFolder): LegalInboxItem[] {
  if (folder === 'quarantine') {
    return items.filter((item) => item.is_quarantined)
  }
  if (folder === 'sent') {
    return items.filter((item) => item.direction === 'outgoing')
  }
  return items.filter((item) => !item.is_quarantined && item.direction === 'incoming')
}

export function useMappedLegalInbox(options: {
  activeFolder: IncomingFolder
  activeFilter: IncomingMailboxFilter
  enabled?: boolean
}) {
  const enabled = options.enabled !== false
  const includeQuarantined = options.activeFolder === 'quarantine'

  const inboxQuery = useLegalInbox(
    { page: 1, page_size: 200, include_quarantined: includeQuarantined },
    { enabled }
  )

  const counterQuery = useLegalInbox(
    { page: 1, page_size: 200, include_quarantined: false },
    { enabled: enabled && options.activeFolder !== 'inbox' }
  )

  const letterTypesQuery = useLegalLetterTypes({ enabled })

  const lookupContext = useMemo(
    () => buildLegalLookupContext(letterTypesQuery.data?.items, undefined),
    [letterTypesQuery.data?.items]
  )

  const folderItems = useMemo(() => {
    if (!inboxQuery.data) return []
    return filterInboxByFolder(inboxQuery.data.items, options.activeFolder)
  }, [inboxQuery.data, options.activeFolder])

  const letters = useMemo(() => {
    const mapped = folderItems.map((item) => mapInboxItemToLetterListItem(item, lookupContext))
    const filtered = filterInboxByMailboxTab(mapped, options.activeFilter)
    return filtered.sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    )
  }, [folderItems, lookupContext, options.activeFilter])

  const unprocessedCount = useMemo(() => {
    if (options.activeFolder === 'inbox' && inboxQuery.data) {
      return inboxQuery.data.unprocessed_count
    }
    const source = counterQuery.data?.items ?? []
    const inboxItems = filterInboxByFolder(source, 'inbox')
    return inboxItems.filter((item) => item.needs_manual_review).length
  }, [counterQuery.data?.items, inboxQuery.data, options.activeFolder])

  const connectedMailboxes = inboxQuery.data?.connected_mailboxes ?? 0

  return {
    letters,
    unprocessedCount,
    connectedMailboxes,
    totalInFolder: folderItems.length,
    isLoading: inboxQuery.isLoading,
    isError: inboxQuery.isError,
    refetch: inboxQuery.refetch,
  }
}

export function useLegalInboxSummary(options?: { enabled?: boolean }) {
  const inboxQuery = useLegalInbox(
    { page: 1, page_size: 1 },
    { enabled: options?.enabled !== false }
  )

  return {
    unprocessedCount: inboxQuery.data?.unprocessed_count ?? 0,
    connectedMailboxes: inboxQuery.data?.connected_mailboxes ?? 0,
    isLoading: inboxQuery.isLoading,
    isError: inboxQuery.isError,
  }
}
