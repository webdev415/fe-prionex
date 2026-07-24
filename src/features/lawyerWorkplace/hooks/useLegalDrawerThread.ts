import { useMemo } from 'react'
import type { LetterDetail, ThreadMessage } from '@/pages/LawyerWorkplace/types'
import { useClient } from '@/features/clients/hooks/useClients'
import {
  buildLegalLookupContext,
  clientLookupFromClient,
  mapMessageAttachments,
  mapMessageToLetterDetail,
  mapThreadMessageToUi,
} from '../api/mappers'
import type { LegalTaskLetter } from '../api/types'
import {
  useLegalLawyers,
  useLegalLetterTypes,
  useLegalMailboxes,
  useLegalMessage,
  useLegalTaskLetters,
  useLegalThread,
} from './useLegalInbox'

function receivedTime(item: LegalTaskLetter): number {
  return item.received_at ? new Date(item.received_at).getTime() : 0
}

function sortByReceivedAsc(items: LegalTaskLetter[]): LegalTaskLetter[] {
  return [...items].sort((a, b) => receivedTime(a) - receivedTime(b))
}

/** Map a grouped-task letter (already carries its body + attachments) to a thread message. */
function mapTaskLetterToThreadMessage(item: LegalTaskLetter): ThreadMessage {
  const mapped = mapThreadMessageToUi(item, { toMailbox: item.to_addresses?.[0] })
  const senderName =
    mapped.direction === 'incoming' && item.client_name?.trim()
      ? item.client_name.trim()
      : mapped.senderName
  return { ...mapped, senderName, attachments: mapMessageAttachments(item.attachments) }
}

/**
 * Thread data for the kanban «Листування» drawer.
 *
 * When a legal task groups several letters (same client + lawyer + day) they
 * live in different email threads, so the grouped conversation is rendered
 * straight from `GET /tasks/{id}/letters` (each letter already carries its body
 * and attachments) and the reply targets the most recent letter. Single-letter
 * tasks keep the full email thread, like {@link useLegalLetterDetail}.
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

  // Reply targets the most recent letter of the group; single-letter tasks use
  // their own message id (also the interim id while the group list loads).
  const lastGroupLetterId = groupLetters.at(-1)?.id ?? null
  const primaryLetterId = isGroup ? (lastGroupLetterId ?? fallbackLetterId) : fallbackLetterId

  const messageQuery = useLegalMessage(primaryLetterId, { enabled })
  const primaryMessage = messageQuery.data ?? null
  const primaryThreadId = primaryMessage?.thread_id ?? null

  // Only single-letter tasks fetch the full email thread; grouped tasks render
  // straight from the /letters payload.
  const singleThreadId = isGroup ? null : primaryThreadId
  const threadQuery = useLegalThread(singleThreadId, { enabled: enabled && !isGroup })

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

  const singleThread = threadQuery.data

  const letter = useMemo((): LetterDetail | null => {
    if (!primaryMessage) return null

    const base = mapMessageToLetterDetail(
      primaryMessage,
      isGroup ? undefined : singleThread,
      lookupContext,
      replyDraft
    )

    if (!isGroup) return base

    return { ...base, thread: groupLetters.map(mapTaskLetterToThreadMessage) }
  }, [groupLetters, isGroup, lookupContext, primaryMessage, replyDraft, singleThread])

  const isLoading =
    messageQuery.isLoading ||
    letterTypesQuery.isLoading ||
    lawyersQuery.isLoading ||
    mailboxesQuery.isLoading ||
    (isGroup ? lettersQuery.isLoading : threadQuery.isLoading) ||
    (needsClientFetch && clientQuery.isLoading)

  const isError = messageQuery.isError || (isGroup ? lettersQuery.isError : threadQuery.isError)

  return {
    letter,
    groupLetters,
    isGroup,
    letterCount,
    isLoading,
    isError,
  }
}
