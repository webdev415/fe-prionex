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
import type {
  AssistantMode,
  AssistantOutputFormat,
  AssistantResponseMode,
} from '@/features/aiAssistant/api'

/** Auto-stop silence timeout for voice dictation (seconds). */
export type AssistantVoiceSilenceTimeout = 1.5 | 2 | 3
/** Hard cap on a single voice recording (seconds). */
export type AssistantVoiceMaxDuration = 30 | 60 | 120

export interface AssistantSettings {
  /** Reasoning depth sent with every chat request: fast (default) | thinking. */
  mode: AssistantMode
  responseMode: AssistantResponseMode
  outputFormat: AssistantOutputFormat
  voiceInputEnabled: boolean
  /**
   * Deep-research flag — when on, the chat request carries `deep_research: true`
   * so the brain runs a thorough multi-agent analysis (the gateway ignores the
   * field until it ships support). Toggled from the composer "+" hub.
   */
  deepResearch: boolean
  /** Voice auto-stop: how long a silence ends the recording (VAD). */
  voiceSilenceTimeoutSec: AssistantVoiceSilenceTimeout
  /** Voice hard stop: max recording length before the timer cuts it off. */
  voiceMaxDurationSec: AssistantVoiceMaxDuration
  useSelectedClientAutomatically: boolean
  useSelectedPeriodAutomatically: boolean
  rememberConversationContext: boolean
  autoScrollToLatestAnswer: boolean
}

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  mode: 'fast',
  responseMode: 'short',
  outputFormat: 'mixed',
  voiceInputEnabled: true,
  deepResearch: false,
  voiceSilenceTimeoutSec: 2,
  voiceMaxDurationSec: 120,
  useSelectedClientAutomatically: true,
  useSelectedPeriodAutomatically: true,
  rememberConversationContext: true,
  autoScrollToLatestAnswer: true,
}

export const AI_ASSISTANT_STORAGE_KEY = 'ai-assistant-storage'

interface AiAssistantState {
  userId: string | null
  conversationId: number | null
  settings: AssistantSettings | null
  /**
   * Conversation-history panel collapsed state. Pure UI preference, so it is
   * intentionally not scoped per user.
   */
  historySidebarCollapsed: boolean

  setActiveConversation: (userId: string, conversationId: number) => void
  clearConversation: () => void
  saveSettings: (userId: string, settings: AssistantSettings) => void
  setHistorySidebarCollapsed: (collapsed: boolean) => void
  conversationIdFor: (userId: string | null) => number | null
  settingsFor: (userId: string | null) => AssistantSettings | null
}

export const useAiAssistantStore = create<AiAssistantState>()(
  persist(
    (set, get) => ({
      userId: null,
      conversationId: null,
      settings: null,
      historySidebarCollapsed: false,

      setActiveConversation: (userId, conversationId) =>
        set((state) => ({
          userId,
          conversationId,
          settings: state.userId === userId ? state.settings : null,
        })),

      clearConversation: () => set({ conversationId: null }),

      setHistorySidebarCollapsed: (collapsed) => set({ historySidebarCollapsed: collapsed }),

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
        if (state.settings == null) return null
        // Merge over defaults so settings persisted before a new field shipped
        // (e.g. deepResearch / voice timings) still resolve to a complete shape.
        return { ...DEFAULT_ASSISTANT_SETTINGS, ...state.settings }
      },
    }),
    {
      name: AI_ASSISTANT_STORAGE_KEY,
      partialize: (state) => ({
        userId: state.userId,
        conversationId: state.conversationId,
        settings: state.settings,
        historySidebarCollapsed: state.historySidebarCollapsed,
      }),
    }
  )
)
