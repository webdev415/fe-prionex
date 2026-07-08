import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConversation,
  getConversations,
  markCitationStep,
  sendChatMessage,
  sendFeedback,
  updateConversation,
  type AssistantChatRequest,
  type AssistantConversationPatch,
  type AssistantConversationsFilters,
  type AssistantConversationSummary,
  type AssistantFeedbackRequest,
  type AssistantMarkCitationRequest,
  type SendChatMessageCallbacks,
} from './api'

export const aiAssistantKeys = {
  all: ['aiAssistant'] as const,
  /** Prefix matching every conversation-list query regardless of filters. */
  conversationLists: ['aiAssistant', 'conversations'] as const,
  conversations: (filters: AssistantConversationsFilters) =>
    [...aiAssistantKeys.all, 'conversations', filters] as const,
  conversation: (id: number) => [...aiAssistantKeys.all, 'conversation', id] as const,
}

/**
 * Variables for {@link useSendAssistantMessage}: the request plus optional
 * stream callbacks. Callbacks ride alongside the payload so the SSE deltas
 * (text/sources/followups/error) reach the component while React Query still
 * owns the request lifecycle and cache invalidation.
 */
export interface SendAssistantMessageVariables {
  payload: AssistantChatRequest
  callbacks?: SendChatMessageCallbacks
}

export function useSendAssistantMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ payload, callbacks }: SendAssistantMessageVariables) =>
      sendChatMessage(payload, callbacks),
    onSuccess: () => {
      // A new message creates/updates a conversation — refresh conversation lists.
      queryClient.invalidateQueries({ queryKey: aiAssistantKeys.all })
    },
  })
}

export function useAssistantConversations(
  filters: AssistantConversationsFilters = {},
  enabled = true
) {
  return useQuery({
    queryKey: aiAssistantKeys.conversations(filters),
    queryFn: () => getConversations(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useAssistantConversation(id: number, enabled = true) {
  return useQuery({
    queryKey: aiAssistantKeys.conversation(id),
    queryFn: () => getConversation(id),
    enabled: enabled && Number.isFinite(id) && id > 0,
    staleTime: 30_000,
  })
}

export interface UpdateAssistantConversationVariables {
  id: number
  patch: AssistantConversationPatch
}

/**
 * PATCH a conversation (title / pinned / archived) with an optimistic update
 * of every cached conversation list. An archived-flag change removes the item
 * from lists fetched with the opposite `archived` filter (it moves between the
 * active and archive views); the target list is refreshed by the settled-time
 * invalidation instead of being patched in place.
 */
export function useUpdateAssistantConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: UpdateAssistantConversationVariables) =>
      updateConversation(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: aiAssistantKeys.conversationLists })
      const previous = queryClient.getQueriesData<AssistantConversationSummary[]>({
        queryKey: aiAssistantKeys.conversationLists,
      })
      for (const [key] of previous) {
        const filters = (key[2] ?? {}) as AssistantConversationsFilters
        queryClient.setQueryData<AssistantConversationSummary[]>(key, (old) => {
          if (!old) return old
          const listIsArchived = filters.archived === true
          if (patch.archived != null && patch.archived !== listIsArchived) {
            return old.filter((item) => item.id !== id)
          }
          return old.map((item) => (item.id === id ? { ...item, ...patch } : item))
        })
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: aiAssistantKeys.conversationLists })
    },
  })
}

export function useSendFeedback() {
  return useMutation({
    mutationFn: (payload: AssistantFeedbackRequest) => sendFeedback(payload),
  })
}

/**
 * Пометить источник факт-сноски верно/неверно (Слой 5) — по образцу
 * {@link useSendFeedback}: fire-and-forget мутация. Оптимистичную подсветку и
 * откат при ошибке держит вызывающий компонент.
 */
export function useMarkCitation() {
  return useMutation({
    mutationFn: (payload: AssistantMarkCitationRequest) => markCitationStep(payload),
  })
}
