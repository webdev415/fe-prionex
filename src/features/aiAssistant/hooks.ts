import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConversation,
  getConversations,
  sendChatMessage,
  sendFeedback,
  type AssistantChatRequest,
  type AssistantConversationsFilters,
  type AssistantFeedbackRequest,
} from './api'

export const aiAssistantKeys = {
  all: ['aiAssistant'] as const,
  conversations: (filters: AssistantConversationsFilters) =>
    [...aiAssistantKeys.all, 'conversations', filters] as const,
  conversation: (id: number) => [...aiAssistantKeys.all, 'conversation', id] as const,
}

export function useSendAssistantMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AssistantChatRequest) => sendChatMessage(payload),
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

export function useSendFeedback() {
  return useMutation({
    mutationFn: (payload: AssistantFeedbackRequest) => sendFeedback(payload),
  })
}
