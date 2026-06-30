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

  const clientId = messageQuery.data?.suggested_client_id ?? null
  const clientQuery = useClient(clientId ?? 0, enabled && clientId != null)

  const lookupContext = useMemo(() => {
    const clients = clientQuery.data ? [clientLookupFromClient(clientQuery.data)] : undefined
    return buildLegalLookupContext(letterTypesQuery.data?.items, lawyersQuery.data?.items, clients)
  }, [clientQuery.data, letterTypesQuery.data?.items, lawyersQuery.data?.items])

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
    (clientId != null && clientQuery.isLoading)

  return {
    letter,
    isLoading,
    isError: messageQuery.isError || threadQuery.isError,
    isFetching: messageQuery.isFetching || threadQuery.isFetching,
  }
}
