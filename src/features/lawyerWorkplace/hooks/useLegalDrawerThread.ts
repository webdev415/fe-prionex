import { useMemo } from 'react'
import type { LetterDetail, ThreadMessage } from '@/pages/LawyerWorkplace/types'
import { useClient } from '@/features/clients/hooks/useClients'
import {
  buildLegalLookupContext,
  clientLookupFromClient,
  mapInboxItemToLetterListItem,
  mapMessageAttachments,
  mapMessageToLetterDetail,
  mapThreadMessageToUi,
} from '../api/mappers'
import type { LegalLookupContext } from '../api/mappers'
import type { LegalInboxItem, LegalTaskLetter } from '../api/types'
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
 * Build the drawer letter for a grouped task straight from `/tasks/{id}/letters`.
 * The reply targets the most recent letter (`lastItem`); the thread is the whole
 * group in chronological order. No per-letter message/thread fetch is needed —
 * every letter (incl. its reply-from mailbox) comes in the /letters payload.
 */
function buildGroupLetterDetail(
  lastItem: LegalTaskLetter,
  thread: ThreadMessage[],
  context: LegalLookupContext,
  replyDraft: string,
  assignedUserId: number | null
): LetterDetail {
  const inboxItem: LegalInboxItem = {
    id: lastItem.id,
    thread_id: lastItem.thread_id,
    mailbox_id: lastItem.mailbox_id,
    mailbox_email: lastItem.mailbox_email,
    subject: lastItem.subject,
    from_address: lastItem.from_address,
    to_addresses: lastItem.to_addresses,
    processing_status: lastItem.processing_status,
    direction: lastItem.direction,
    received_at: lastItem.received_at,
    is_quarantined: lastItem.is_quarantined,
    needs_manual_review: lastItem.needs_manual_review,
    suggested_letter_type_id: lastItem.letter_type_id,
    suggested_client_id: lastItem.client_id,
    suggested_client_name: lastItem.client_name,
    suggested_lawyer_user_id: null,
    auto_process_eligible: false,
  }
  const listItem = mapInboxItemToLetterListItem(inboxItem, context)

  return {
    ...listItem,
    recipientEmail: listItem.routeToEmail,
    thread,
    parameters: {
      letterType: listItem.letterType ?? '',
      clientId: lastItem.client_id != null ? String(lastItem.client_id) : '',
      clientLabel: listItem.clientCode
        ? `${listItem.clientCode}${listItem.clientName ? ` · ${listItem.clientName}` : ''}`
        : '',
      clientLockedByEmail: false,
      clientProjectId: null,
      contractId: '',
      contractLabel: '',
      dueDate: '',
      dueDateHint: '',
      lawyerId: '',
      lawyerLabel: '',
      autoConfidence: 0,
      confirmedCount: 0,
      totalParameters: 4,
    },
    replyDraft,
    replyContext: {
      threadId: lastItem.thread_id,
      mailboxId: lastItem.mailbox_id,
      inReplyToMessageId: lastItem.id,
      clientId: lastItem.client_id,
      // Prefer the lawyer the task is assigned to; the backend still falls back
      // to the source letter's confirmed lawyer when this is null.
      assignedUserId,
    },
    legalTaskId: null,
    confirmedLetterTypeId: null,
    suggestedLetterTypeId: lastItem.letter_type_id,
    processingStatus: lastItem.processing_status,
    updatedAt: null,
    sourceMailboxDisabled: lastItem.source_mailbox_disabled,
  }
}

/**
 * Thread data for the kanban «Листування» drawer.
 *
 * When a legal task groups several letters (same client + lawyer + day) they
 * live in different email threads, so the grouped conversation is rendered
 * straight from `GET /tasks/{id}/letters` (each letter already carries its body,
 * attachments and reply-from mailbox) and the reply targets the most recent
 * letter. Single-letter tasks keep the full email thread, like
 * {@link useLegalLetterDetail}.
 */
export function useLegalDrawerThread(params: {
  legalTaskId: number
  fallbackLetterId: string | null
  letterCount: number
  /** Lawyer the task is assigned to — used as the reply lawyer for grouped tasks. */
  assignedUserId?: number | null
  replyDraft?: string
  enabled?: boolean
}) {
  const { legalTaskId, fallbackLetterId, letterCount, enabled = true } = params
  const assignedUserId = params.assignedUserId ?? null
  const replyDraft = params.replyDraft ?? ''
  const isGroup = letterCount > 1 && legalTaskId > 0

  const lettersQuery = useLegalTaskLetters(legalTaskId, { enabled: enabled && isGroup })

  const groupItems = lettersQuery.data?.items
  const groupLetters = useMemo(
    () => (groupItems ? sortByReceivedAsc(groupItems) : []),
    [groupItems]
  )

  // Single-letter tasks fetch their message + full thread; grouped tasks render
  // straight from the /letters payload (no per-letter fetch).
  const messageQuery = useLegalMessage(isGroup ? null : fallbackLetterId, {
    enabled: enabled && !isGroup,
  })
  const primaryMessage = messageQuery.data ?? null
  const primaryThreadId = primaryMessage?.thread_id ?? null
  const threadQuery = useLegalThread(isGroup ? null : primaryThreadId, {
    enabled: enabled && !isGroup,
  })

  const letterTypesQuery = useLegalLetterTypes({ enabled })
  const lawyersQuery = useLegalLawyers({ enabled })
  const mailboxesQuery = useLegalMailboxes({ enabled })

  // Single-letter tasks may need a client lookup; grouped letters already carry
  // client_name in the /letters payload.
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
    if (isGroup) {
      const lastItem = groupLetters.at(-1)
      if (!lastItem) return null
      const thread = groupLetters.map(mapTaskLetterToThreadMessage)
      return buildGroupLetterDetail(lastItem, thread, lookupContext, replyDraft, assignedUserId)
    }
    if (!primaryMessage) return null
    return mapMessageToLetterDetail(primaryMessage, singleThread, lookupContext, replyDraft)
  }, [
    assignedUserId,
    groupLetters,
    isGroup,
    lookupContext,
    primaryMessage,
    replyDraft,
    singleThread,
  ])

  const isLoading =
    letterTypesQuery.isLoading ||
    lawyersQuery.isLoading ||
    mailboxesQuery.isLoading ||
    (isGroup
      ? lettersQuery.isLoading
      : messageQuery.isLoading ||
        threadQuery.isLoading ||
        (needsClientFetch && clientQuery.isLoading))

  const isError = isGroup ? lettersQuery.isError : messageQuery.isError || threadQuery.isError

  return {
    letter,
    groupLetters,
    isGroup,
    letterCount,
    isLoading,
    isError,
  }
}
