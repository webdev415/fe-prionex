import { useMemo } from 'react'
import type { LetterDetail, LetterListItem } from '@/pages/LawyerWorkplace/types'
import { useClient } from '@/features/clients/hooks/useClients'
import {
  buildLegalLookupContext,
  clientLookupFromClient,
  mapListItemToPreviewDetail,
  mapMessageToLetterDetail,
} from '../api/mappers'
import {
  useLegalLawyers,
  useLegalLetterTypes,
  useLegalMailboxes,
  useLegalMessage,
  useLegalThread,
} from './useLegalInbox'

export function useLegalLetterDetail(
  messageId: string | null,
  options?: {
    enabled?: boolean
    includeQuarantined?: boolean
    replyDraft?: string
    listFallback?: LetterListItem | null
  }
) {
  const enabled = options?.enabled !== false && Boolean(messageId)
  const replyDraft = options?.replyDraft ?? ''
  const listFallback = options?.listFallback ?? null
  const includeQuarantined = options?.includeQuarantined ?? false

  const messageQuery = useLegalMessage(messageId, { enabled })
  const threadId = messageQuery.data?.thread_id ?? null
  const threadQuery = useLegalThread(threadId, {
    enabled: enabled && Boolean(threadId),
    includeQuarantined,
  })
  const letterTypesQuery = useLegalLetterTypes({ enabled })
  const lawyersQuery = useLegalLawyers({ enabled })
  const mailboxesQuery = useLegalMailboxes({ enabled })

  const clientId = messageQuery.data?.suggested_client_id ?? null
  const needsClientFetch = clientId != null && !messageQuery.data?.suggested_client_name?.trim()
  const clientQuery = useClient(clientId ?? 0, enabled && needsClientFetch)

  const lookupContext = useMemo(() => {
    let clients: ReturnType<typeof clientLookupFromClient>[] | undefined
    if (messageQuery.data?.suggested_client_id && messageQuery.data.suggested_client_name?.trim()) {
      const id = messageQuery.data.suggested_client_id
      const name = messageQuery.data.suggested_client_name.trim()
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
    messageQuery.data,
  ])

  const letter = useMemo((): LetterDetail | null => {
    if (messageQuery.data) {
      return mapMessageToLetterDetail(
        messageQuery.data,
        threadQuery.data,
        lookupContext,
        replyDraft
      )
    }
    if (listFallback && (messageQuery.isLoading || threadQuery.isLoading)) {
      return mapListItemToPreviewDetail(listFallback, replyDraft)
    }
    return null
  }, [
    lookupContext,
    listFallback,
    messageQuery.data,
    messageQuery.isLoading,
    replyDraft,
    threadQuery.data,
    threadQuery.isLoading,
  ])

  const isLoading =
    messageQuery.isLoading ||
    threadQuery.isLoading ||
    letterTypesQuery.isLoading ||
    lawyersQuery.isLoading ||
    mailboxesQuery.isLoading ||
    (clientId != null && needsClientFetch && clientQuery.isLoading)

  return {
    letter,
    isLoading,
    isError: messageQuery.isError || threadQuery.isError,
    isFetching: messageQuery.isFetching || threadQuery.isFetching,
  }
}
