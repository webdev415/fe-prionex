import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { IncomingFolder, IncomingMailboxFilter } from '@/pages/LawyerWorkplace/types'
import { legalApi } from '../api/legalApi'
import { buildLegalLookupContext, mapInboxItemToLetterListItem } from '../api/mappers'
import type { LegalInboxParams, LegalDocumentListParams } from '../api/types'

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
  mailboxes: () => [...legalWorkplaceKeys.all, 'mailboxes'] as const,
  settingsMailboxes: () => [...legalWorkplaceKeys.settings(), 'mailboxes'] as const,
  syncSettings: () => [...legalWorkplaceKeys.settings(), 'sync'] as const,
  replyTemplates: (includeInactive?: boolean) =>
    [...legalWorkplaceKeys.settings(), 'reply-templates', { includeInactive }] as const,
  replyTemplatesRoot: () => [...legalWorkplaceKeys.settings(), 'reply-templates'] as const,
  composerReplyTemplates: (letterTypeId?: string | null) =>
    [...legalWorkplaceKeys.all, 'reply-templates', { letterTypeId }] as const,
  composerReplyTemplatesRoot: () => [...legalWorkplaceKeys.all, 'reply-templates'] as const,
  kanban: (assignedToUserId?: number) =>
    [...legalWorkplaceKeys.all, 'kanban', { assignedToUserId }] as const,
  documents: () => [...legalWorkplaceKeys.all, 'documents'] as const,
  documentsList: (params: LegalDocumentListParams) =>
    [...legalWorkplaceKeys.documents(), 'list', params] as const,
  documentStats: (year?: number) => [...legalWorkplaceKeys.documents(), 'stats', { year }] as const,
  documentFilterCounts: () => [...legalWorkplaceKeys.documents(), 'filter-counts'] as const,
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

export function useLegalMailboxes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.mailboxes(),
    queryFn: () => legalApi.listMailboxes(),
    enabled: options?.enabled !== false,
    staleTime: 60_000,
  })
}

export function useLegalSettingsMailboxes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.settingsMailboxes(),
    queryFn: () => legalApi.listSettingsMailboxes(),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
  })
}

export function useLegalSyncSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.syncSettings(),
    queryFn: () => legalApi.getSyncSettings(),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
  })
}

export function useLegalSettingsReplyTemplates(options?: {
  enabled?: boolean
  includeInactive?: boolean
}) {
  const includeInactive = options?.includeInactive ?? true
  return useQuery({
    queryKey: legalWorkplaceKeys.replyTemplates(includeInactive),
    queryFn: () => legalApi.listSettingsReplyTemplates({ include_inactive: includeInactive }),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
  })
}

export function useLegalComposerReplyTemplates(
  letterTypeId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: legalWorkplaceKeys.composerReplyTemplates(letterTypeId),
    queryFn: () =>
      legalApi.listComposerReplyTemplates({
        letter_type_id: letterTypeId ?? undefined,
      }),
    enabled: options?.enabled !== false,
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

// ── Folder → API params mapping ───────────────────────────────────────────────

function folderToApiParams(folder: IncomingFolder): {
  include_quarantined: boolean
  direction?: string
} {
  if (folder === 'quarantine') return { include_quarantined: true }
  if (folder === 'sent') return { include_quarantined: false, direction: 'outgoing' }
  return { include_quarantined: false, direction: 'incoming' }
}

// "done" tab maps to a special backend value covering all completed statuses
function filterToProcessingStatus(filter: IncomingMailboxFilter): string | undefined {
  if (filter === 'all') return undefined
  if (filter === 'done') return 'done'
  return filter // 'new' | 'in_progress'
}

// ── Paginated server-side inbox hook ─────────────────────────────────────────

const PAGE_SIZE = 50

export function useMappedLegalInbox(options: {
  activeFolder: IncomingFolder
  activeFilter: IncomingMailboxFilter
  page: number
  searchQuery: string // committed search (only sent on explicit submit)
  enabled?: boolean
}) {
  const enabled = options.enabled !== false

  const folderParams = folderToApiParams(options.activeFolder)
  const processingStatus = filterToProcessingStatus(options.activeFilter)

  const apiParams: LegalInboxParams = {
    page: options.page,
    page_size: PAGE_SIZE,
    ...folderParams,
    ...(processingStatus ? { processing_status: processingStatus } : {}),
    ...(options.searchQuery.trim() ? { q: options.searchQuery.trim() } : {}),
  }

  const inboxQuery = useLegalInbox(apiParams, { enabled })
  const letterTypesQuery = useLegalLetterTypes({ enabled })

  const lookupContext = useMemo(
    () => buildLegalLookupContext(letterTypesQuery.data?.items, undefined),
    [letterTypesQuery.data?.items]
  )

  const letters = useMemo(() => {
    if (!inboxQuery.data) return []
    // Backend returns messages sorted by received_at desc across all mailboxes
    return inboxQuery.data.items.map((item) => mapInboxItemToLetterListItem(item, lookupContext))
  }, [inboxQuery.data, lookupContext])

  const data = inboxQuery.data
  const total = data?.total ?? 0
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1

  return {
    letters,
    unprocessedCount: data?.unprocessed_count ?? 0,
    connectedMailboxes: data?.connected_mailboxes ?? 0,
    total,
    totalPages,
    countAll: data?.count_all ?? 0,
    countNew: data?.count_new ?? 0,
    countInProgress: data?.count_in_progress ?? 0,
    countDone: data?.count_done ?? 0,
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
