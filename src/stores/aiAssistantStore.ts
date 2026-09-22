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
import {
  clampReasoningPanelWidth,
  DEFAULT_REASONING_PANEL_WIDTH,
} from '@/pages/AiAssistant/reasoningPanelConfig'

/** Auto-stop silence timeout for voice dictation (seconds). */
export type AssistantVoiceSilenceTimeout = 1.5 | 2 | 3
/** Hard cap on a single voice recording (seconds). */
export type AssistantVoiceMaxDuration = 30 | 60 | 120

export interface AssistantSettings {
  /** Reasoning depth sent with every chat request: fast (default) | thinking. */
  mode: AssistantMode
  /**
   * Выбранная модель внешнего Claude («Експерт») или `null` — обычный ход на
   * нашем боксе. Отдельное поле, а не третье значение {@link AssistantMode}:
   * `mode` уходит в тело запроса как есть, и подмешивать туда «expert» значило
   * бы менять контракт хода ради состояния меню.
   *
   * Хранится, как и остальные настройки, в localStorage — но правом на режим
   * распоряжается бэкенд: страница шлёт `expert` только когда `capabilities`
   * подтвердили доступ и эту модель (иначе значение молча игнорируется).
   */
  expertModel: string | null
  /**
   * Раздумья 31B («Міркування 31B» в меню режима) — ОДИН тумблер на две вещи:
   * просить ли «думающий» ход рассуждать (`thinking` в теле запроса) и
   * показывать ли этот ход оператору (плашка в бабле + секция панели
   * «Активность»). Раньше настройка была чисто клиентской; теперь снятый
   * тумблер ещё и экономит время ответа — 31B отвечает без раздумий.
   *
   * Имя поля намеренно прежнее: у оператора, снявшего тумблер до этой правки,
   * выбор обязан пережить обновление — переименование потребовало бы миграции
   * localStorage ради того же самого смысла.
   *
   * Шаги оркестратора и «Источники» тумблер не прячет — по ним оператор
   * проверяет факты ответа.
   */
  showReasoning: boolean
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
  expertModel: null,
  showReasoning: true,
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
  /**
   * Width (px) of the reasoning «Активность» side panel. Pure UI preference,
   * not scoped per user; clamped into the resizable range on read.
   */
  reasoningPanelWidth: number

  setActiveConversation: (userId: string, conversationId: number) => void
  clearConversation: () => void
  saveSettings: (userId: string, settings: AssistantSettings) => void
  setHistorySidebarCollapsed: (collapsed: boolean) => void
  setReasoningPanelWidth: (width: number) => void
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
      reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,

      setActiveConversation: (userId, conversationId) =>
        set((state) => ({
          userId,
          conversationId,
          settings: state.userId === userId ? state.settings : null,
        })),

      clearConversation: () => set({ conversationId: null }),

      setHistorySidebarCollapsed: (collapsed) => set({ historySidebarCollapsed: collapsed }),

      setReasoningPanelWidth: (width) =>
        set({ reasoningPanelWidth: clampReasoningPanelWidth(width) }),

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
        reasoningPanelWidth: state.reasoningPanelWidth,
      }),
    }
  )
)
