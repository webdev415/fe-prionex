import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { LetterDetail } from '@/pages/LawyerWorkplace/types'
import { useClient } from '@/features/clients/hooks/useClients'
import { legalApi } from '../api/legalApi'
import {
  buildLegalLookupContext,
  clientLookupFromClient,
  mapMessageToLetterDetail,
} from '../api/mappers'
import type { LegalInboxItem, LegalThreadDetail } from '../api/types'
import {
  legalWorkplaceKeys,
  useLegalLawyers,
  useLegalLetterTypes,
  useLegalMailboxes,
  useLegalMessage,
  useLegalTaskLetters,
} from './useLegalInbox'

function receivedTime(item: LegalInboxItem): number {
  return item.received_at ? new Date(item.received_at).getTime() : 0
}

function sortByReceivedAsc(items: LegalInboxItem[]): LegalInboxItem[] {
  return [...items].sort((a, b) => receivedTime(a) - receivedTime(b))
}

/**
 * Thread data for the kanban «Листування» drawer.
 *
 * A legal task can group several letters (same client + lawyer + day). When it
 * does, this hook merges every grouped letter's thread into one chronological
 * conversation and points the reply at the most recent letter. Single-letter
 * tasks behave exactly like {@link useLegalLetterDetail}.
 */
export function useLegalDrawerThread(params: {
  legalTaskId: number
  fallbackLetterId: string | null
  letterCount: number
  replyDraft?: string
  enabled?: boolean
}) {
  const { legalTaskId, fallbackLetterId, letterCount, enabled = true } = params
  const replyDraft = params.replyDraft ?? ''
  const isGroup = letterCount > 1 && legalTaskId > 0

  const lettersQuery = useLegalTaskLetters(legalTaskId, { enabled: enabled && isGroup })

  const groupItems = lettersQuery.data?.items
  const groupLetters = useMemo(
    () => (groupItems ? sortByReceivedAsc(groupItems) : []),
    [groupItems]
  )

  // Reply always targets the most recent letter in the group; single-letter
  // tasks fall back to their own message id.
  const primaryLetterId = isGroup ? (groupLetters.at(-1)?.id ?? fallbackLetterId) : fallbackLetterId

  const messageQuery = useLegalMessage(primaryLetterId, { enabled })
  const primaryMessage = messageQuery.data ?? null
  const primaryThreadId = primaryMessage?.thread_id ?? null

  // Distinct thread ids: every grouped letter's thread plus the primary
  // message's thread (in case it is not represented in the group list yet).
  const threadIds = useMemo(() => {
    const ids = new Set<string>()
    if (isGroup) {
      for (const letter of groupLetters) {
        if (letter.thread_id) ids.add(letter.thread_id)
      }
    }
    if (primaryThreadId) ids.add(primaryThreadId)
    return [...ids]
  }, [groupLetters, isGroup, primaryThreadId])

  const threadQueries = useQueries({
    queries: threadIds.map((threadId) => ({
      queryKey: legalWorkplaceKeys.thread(threadId, false),
      queryFn: () => legalApi.getThread(threadId, { include_quarantined: false }),
      enabled: enabled && Boolean(threadId),
      staleTime: 10_000,
    })),
  })

  const letterTypesQuery = useLegalLetterTypes({ enabled })
  const lawyersQuery = useLegalLawyers({ enabled })
  const mailboxesQuery = useLegalMailboxes({ enabled })

  const clientId = primaryMessage?.suggested_client_id ?? null
  const needsClientFetch = clientId != null && !primaryMessage?.suggested_client_name?.trim()
  const clientQuery = useClient(clientId ?? 0, enabled && needsClientFetch)

  const lookupContext = useMemo(() => {
    let clients: ReturnType<typeof clientLookupFromClient>[] | undefined
    if (primaryMessage?.suggested_client_id && primaryMessage.suggested_client_name?.trim()) {
      const id = primaryMessage.suggested_client_id
      const name = primaryMessage.suggested_client_name.trim()
      const code = `CL-${id}`
      clients = [{ id, code, name, label: `${code} · ${name}` }]
    } else if (clientQuery.data) {
      clients = [clientLookupFromClient(clientQuery.data)]
    }
    return buildLegalLookupContext(
      letterTypesQuery.data?.items,
      lawyersQuery.data?.items,
      clients,
      mailboxesQuery.data?.items
    )
  }, [
    clientQuery.data,
    letterTypesQuery.data?.items,
    lawyersQuery.data?.items,
    mailboxesQuery.data?.items,
    primaryMessage,
  ])

  const threadsById = useMemo(() => {
    const map = new Map<string, LegalThreadDetail>()
    for (const query of threadQueries) {
      if (query.data) map.set(query.data.id, query.data)
    }
    return map
  }, [threadQueries])

  const letter = useMemo((): LetterDetail | null => {
    if (!primaryMessage) return null

    const primaryThread = threadsById.get(primaryMessage.thread_id)
    const base = mapMessageToLetterDetail(primaryMessage, primaryThread, lookupContext, replyDraft)

    if (!isGroup) return base

    // Merge every grouped thread into a single chronological conversation.
    // Each thread is mapped relative to the primary message so client-name
    // layering stays consistent, then deduped by message id and time-sorted.
    const merged: LetterDetail['thread'] = []
    const seen = new Set<string>()
    const pushMessages = (messages: LetterDetail['thread']) => {
      for (const message of messages) {
        if (seen.has(message.id)) continue
        seen.add(message.id)
        merged.push(message)
      }
    }

    for (const letterItem of groupLetters) {
      const thread = letterItem.thread_id ? threadsById.get(letterItem.thread_id) : undefined
      if (!thread) continue
      pushMessages(mapMessageToLetterDetail(primaryMessage, thread, lookupContext, '').thread)
    }
    // Primary thread last, so any message not represented in the group is kept.
    pushMessages(base.thread)

    merged.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())

    return { ...base, thread: merged }
  }, [groupLetters, isGroup, lookupContext, primaryMessage, replyDraft, threadsById])

  const isLoading =
    messageQuery.isLoading ||
    letterTypesQuery.isLoading ||
    lawyersQuery.isLoading ||
    mailboxesQuery.isLoading ||
    (isGroup && lettersQuery.isLoading) ||
    threadQueries.some((query) => query.isLoading) ||
    (needsClientFetch && clientQuery.isLoading)

  const isError =
    messageQuery.isError ||
    (isGroup && lettersQuery.isError) ||
    threadQueries.some((query) => query.isError)

  return {
    letter,
    groupLetters,
    isGroup,
    letterCount,
    isLoading,
    isError,
  }
}
