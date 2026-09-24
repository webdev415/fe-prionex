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
/**
 * Явный выбор оператора по раздумьям 31B (см. `AssistantSettings.thinkingChoice`);
 * «не выбирали» — это `null`, а не третье значение.
 */
export type AssistantThinkingChoice = 'on' | 'off'

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
   * Показывать ли оператору ход рассуждения модели — плашку «Ход рассуждения» в
   * бабле и одноимённую секцию панели «Активность». Чисто клиентская настройка:
   * `reasoning` приходит отдельным SSE-кадром, и в тело запроса это поле не
   * попадает. Шаги оркестратора и «Источники» под ней не прячутся — по ним
   * оператор проверяет факты ответа.
   *
   * Тип и смысл намеренно прежние (boolean, «показывать»): запись в
   * localStorage обязана читаться и сборкой до появления {@link thinkingChoice}
   * — откат фронта не должен сбрасывать операторам настройки. Переключатель
   * «Міркування 31B» ведёт это поле следом за собой (`'off'` → `false`, иначе
   * `true`), чтобы после отката спрятанные раздумья остались спрятанными.
   */
  showReasoning: boolean
  /**
   * Явный выбор оператора по раздумьям 31B — по контракту шлюза
   * (`ASSISTANT_MODES.md`, поле `thinking: true | false | null`): поле уходит в
   * запрос ТОЛЬКО когда оператор выбрал сам.
   * - `null` — не выбирали («Сервер»): поля в теле нет, режим решает сервер
   *   (его дефолт сейчас «с раздумьями»); клиент этот дефолт не дублирует,
   *   иначе у CRM появился бы второй, расходящийся с мозгом;
   * - `'on'` / `'off'` — явный выбор, уходит как `true` / `false`.
   *
   * Отдельное поле рядом с {@link showReasoning}, а не третье значение в нём:
   * старая сборка читает запись как прежде (лишний ключ она просто не видит),
   * версия схемы хранилища не меняется.
   */
  thinkingChoice: AssistantThinkingChoice | null
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
  thinkingChoice: null,
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

/**
 * Версия схемы localStorage — и она обязана оставаться `0`.
 *
 * Поднять версию значит сломать откат: сборка без `migrate` (все прежние)
 * при `stored.version !== version` пишет console.error и поднимает стор
 * дефолтами — режим, формат ответа, тайминги голоса и указатель диалога у
 * каждого оператора обнуляются, а первый же `set` перезаписывает запись. Новые
 * настройки добавляются аддитивно (лишний ключ старая сборка не видит), смысл
 * и тип существующих ключей не меняются.
 */
export const AI_ASSISTANT_STORAGE_VERSION = 0

/**
 * Значение поля `thinking` в теле запроса для выбора оператора: только явный
 * выбор даёт поле, «не выбирали» (`null`, а также отсутствие настроек) — поля
 * нет вовсе, и режим решает сервер.
 */
export function thinkingFlagFor(
  choice: AssistantThinkingChoice | null | undefined
): boolean | undefined {
  if (choice === 'on') return true
  if (choice === 'off') return false
  return undefined
}

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
      version: AI_ASSISTANT_STORAGE_VERSION,
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
