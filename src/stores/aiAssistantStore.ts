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
   * Три значения, а не два — по контракту шлюза (`ASSISTANT_MODES.md`, флаг
   * `thinking`): поле уходит в запрос ТОЛЬКО когда оператор выбрал сам.
   * - `null` — тумблер не трогали: поле не шлём, режим решает сервер (его
   *   дефолт сейчас «с раздумьями»), а всё, что приходит, показываем;
   * - `true` / `false` — явный выбор: уходит как есть.
   * В UI `null` выглядит как включённый тумблер — так же, как серверный дефолт.
   *
   * Имя поля намеренно прежнее: у оператора, снявшего тумблер до этой правки,
   * выбор обязан пережить обновление. Хранившееся раньше `true` значило лишь
   * «показывать, если пришло» — ровно нынешний `null`, в него оно и мигрирует
   * (см. `migrate` ниже), чтобы фронт не пришпиливал серверный дефолт.
   *
   * Шаги оркестратора и «Источники» тумблер не прячет — по ним оператор
   * проверяет факты ответа.
   */
  showReasoning: boolean | null
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
  showReasoning: null,
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
 * Версия схемы localStorage. 0 → 1: `showReasoning` стал трёхзначным, прежнее
 * `true` («показывать, если пришло») переводится в `null` («сервер решает»).
 */
export const AI_ASSISTANT_STORAGE_VERSION = 1

/**
 * Показывать ли оператору ход рассуждения при текущем значении тумблера: прячет
 * только явное «выключено»; `null` (не трогали) и `true` показывают.
 */
export function isReasoningShown(showReasoning: boolean | null | undefined): boolean {
  return showReasoning !== false
}

/** Форма записи в localStorage (см. `partialize` ниже) — то, что видит `migrate`. */
type PersistedAiAssistantState = {
  userId?: string | null
  conversationId?: number | null
  settings?: (Partial<AssistantSettings> & { showReasoning?: unknown }) | null
  historySidebarCollapsed?: boolean
  reasoningPanelWidth?: number
}

/**
 * Миграция записи со старой схемой. Версия 0 хранила `showReasoning: boolean`,
 * где `true` было и дефолтом, и «показывать» — ни то, ни другое не означало
 * просьбы к серверу думать, поэтому `true` → `null`. Явное `false` остаётся:
 * оператор прятал раздумья, теперь он их ещё и выключает (быстрее ответ), а чип
 * факта хода покажет, чем ход шёл на самом деле.
 */
export function migrateAiAssistantState(persisted: unknown, version: number): unknown {
  if (version >= AI_ASSISTANT_STORAGE_VERSION) return persisted
  if (!persisted || typeof persisted !== 'object') return persisted
  const state = persisted as PersistedAiAssistantState
  if (!state.settings || typeof state.settings !== 'object') return persisted
  if (state.settings.showReasoning !== true) return persisted
  return { ...state, settings: { ...state.settings, showReasoning: null } }
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
      migrate: migrateAiAssistantState as (
        persisted: unknown,
        version: number
      ) => Pick<
        AiAssistantState,
        'userId' | 'conversationId' | 'settings' | 'historySidebarCollapsed' | 'reasoningPanelWidth'
      >,
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
