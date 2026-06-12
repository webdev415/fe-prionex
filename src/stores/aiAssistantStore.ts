/**
 * AI Assistant Store
 *
 * Persists the active assistant conversation pointer and assistant settings in
 * localStorage so navigating away from /dashboard/ai-assistant (or reloading)
 * does not lose the dialog. Message history itself stays on the backend and is
 * re-hydrated from GET /ai-assistant/conversations/{id}.
 *
 * All data is scoped to a single owner user: selectors return null for any
 * other user id, and writes for a different user drop the previous user's
 * state so conversations/settings never leak between accounts sharing a
 * browser.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AssistantOutputFormat, AssistantResponseMode } from '@/features/aiAssistant/api'

export interface AssistantSettings {
  responseMode: AssistantResponseMode
  outputFormat: AssistantOutputFormat
  voiceInputEnabled: boolean
  useSelectedClientAutomatically: boolean
  useSelectedPeriodAutomatically: boolean
  rememberConversationContext: boolean
  showQuickSuggestionsAfterResponse: boolean
  autoScrollToLatestAnswer: boolean
}

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  responseMode: 'short',
  outputFormat: 'mixed',
  voiceInputEnabled: true,
  useSelectedClientAutomatically: true,
  useSelectedPeriodAutomatically: true,
  rememberConversationContext: true,
  showQuickSuggestionsAfterResponse: true,
  autoScrollToLatestAnswer: true,
}

export const AI_ASSISTANT_STORAGE_KEY = 'ai-assistant-storage'

interface AiAssistantState {
  userId: string | null
  conversationId: number | null
  settings: AssistantSettings | null

  setActiveConversation: (userId: string, conversationId: number) => void
  clearConversation: () => void
  saveSettings: (userId: string, settings: AssistantSettings) => void
  conversationIdFor: (userId: string | null) => number | null
  settingsFor: (userId: string | null) => AssistantSettings | null
}

export const useAiAssistantStore = create<AiAssistantState>()(
  persist(
    (set, get) => ({
      userId: null,
      conversationId: null,
      settings: null,

      setActiveConversation: (userId, conversationId) =>
        set((state) => ({
          userId,
          conversationId,
          settings: state.userId === userId ? state.settings : null,
        })),

      clearConversation: () => set({ conversationId: null }),

      saveSettings: (userId, settings) =>
        set((state) => ({
          userId,
          settings,
          conversationId: state.userId === userId ? state.conversationId : null,
        })),

      conversationIdFor: (userId) => {
        const state = get()
        if (userId == null || state.userId !== userId) return null
        return state.conversationId
      },

      settingsFor: (userId) => {
        const state = get()
        if (userId == null || state.userId !== userId) return null
        return state.settings
      },
    }),
    {
      name: AI_ASSISTANT_STORAGE_KEY,
      partialize: (state) => ({
        userId: state.userId,
        conversationId: state.conversationId,
        settings: state.settings,
      }),
    }
  )
)
