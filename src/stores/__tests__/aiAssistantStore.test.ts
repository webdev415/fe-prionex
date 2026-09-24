import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_ASSISTANT_SETTINGS,
  useAiAssistantStore,
  AI_ASSISTANT_STORAGE_KEY,
  AI_ASSISTANT_STORAGE_VERSION,
  thinkingFlagFor,
  type AssistantSettings,
} from '../aiAssistantStore'

/** Запись localStorage в форме `persist` (state + version). */
function storedRecord(settings: Record<string, unknown>, version: number) {
  return JSON.stringify({
    state: {
      userId: '7',
      conversationId: null,
      settings: { ...DEFAULT_ASSISTANT_SETTINGS, ...settings },
      historySidebarCollapsed: false,
      reasoningPanelWidth: 420,
    },
    version,
  })
}

describe('aiAssistantStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
  })

  it('returns null conversation when nothing is stored', () => {
    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBeNull()
    expect(useAiAssistantStore.getState().conversationIdFor(null)).toBeNull()
  })

  it('stores active conversation scoped to the user', () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)

    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBe(42)
    expect(useAiAssistantStore.getState().conversationIdFor('8')).toBeNull()
    expect(useAiAssistantStore.getState().conversationIdFor(null)).toBeNull()
  })

  it('clearConversation drops the conversation pointer but keeps settings', () => {
    useAiAssistantStore.getState().saveSettings('7', {
      ...DEFAULT_ASSISTANT_SETTINGS,
      responseMode: 'detailed',
    })
    useAiAssistantStore.getState().setActiveConversation('7', 42)

    useAiAssistantStore.getState().clearConversation()

    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBeNull()
    expect(useAiAssistantStore.getState().settingsFor('7')?.responseMode).toBe('detailed')
  })

  it('switching to another user drops the previous user data', () => {
    useAiAssistantStore.getState().saveSettings('7', {
      ...DEFAULT_ASSISTANT_SETTINGS,
      responseMode: 'detailed',
    })
    useAiAssistantStore.getState().setActiveConversation('7', 42)

    useAiAssistantStore.getState().setActiveConversation('8', 99)

    expect(useAiAssistantStore.getState().conversationIdFor('8')).toBe(99)
    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBeNull()
    // settings belonged to user 7 — must not leak to user 8
    expect(useAiAssistantStore.getState().settingsFor('8')).toBeNull()
  })

  it('saveSettings for another user drops the previous conversation pointer', () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)

    useAiAssistantStore.getState().saveSettings('8', DEFAULT_ASSISTANT_SETTINGS)

    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBeNull()
    expect(useAiAssistantStore.getState().conversationIdFor('8')).toBeNull()
    expect(useAiAssistantStore.getState().settingsFor('8')).toEqual(DEFAULT_ASSISTANT_SETTINGS)
  })

  it('persists state to localStorage so it survives a reload', () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)

    const raw = localStorage.getItem(AI_ASSISTANT_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as {
      state: { userId: string; conversationId: number }
    }
    expect(parsed.state.userId).toBe('7')
    expect(parsed.state.conversationId).toBe(42)
  })

  it('defaults the response mode to fast', () => {
    expect(DEFAULT_ASSISTANT_SETTINGS.mode).toBe('fast')
  })

  it('persists the chosen response mode across reloads', () => {
    useAiAssistantStore.getState().saveSettings('7', {
      ...DEFAULT_ASSISTANT_SETTINGS,
      mode: 'thinking',
    })

    const raw = localStorage.getItem(AI_ASSISTANT_STORAGE_KEY)
    const parsed = JSON.parse(raw as string) as {
      state: { settings: { mode: string } | null }
      version: number
    }
    expect(parsed.state.settings?.mode).toBe('thinking')
    expect(parsed.version).toBe(AI_ASSISTANT_STORAGE_VERSION)
  })

  describe('раздумья 31B: thinkingChoice рядом с прежним showReasoning', () => {
    it('по умолчанию выбора нет (null), а showReasoning остаётся прежним boolean-дефолтом', () => {
      expect(DEFAULT_ASSISTANT_SETTINGS.thinkingChoice).toBeNull()
      expect(DEFAULT_ASSISTANT_SETTINGS.showReasoning).toBe(true)
    })

    it('thinkingFlagFor: поле уходит только при явном выборе', () => {
      expect(thinkingFlagFor('on')).toBe(true)
      expect(thinkingFlagFor('off')).toBe(false)
      expect(thinkingFlagFor(null)).toBeUndefined()
      // Настроек нет вовсе (первый вход) — поля тоже нет.
      expect(thinkingFlagFor(undefined)).toBeUndefined()
    })

    it('схема хранилища остаётся версии 0: откат фронта не должен сбрасывать настройки', () => {
      expect(AI_ASSISTANT_STORAGE_VERSION).toBe(0)
      useAiAssistantStore.getState().saveSettings('7', {
        ...DEFAULT_ASSISTANT_SETTINGS,
        thinkingChoice: 'off',
      })
      const parsed = JSON.parse(localStorage.getItem(AI_ASSISTANT_STORAGE_KEY) as string) as {
        version: number
      }
      expect(parsed.version).toBe(0)
    })

    it('запись старого фронта (без thinkingChoice) поднимается как «не выбирали», showReasoning как было', async () => {
      const legacy = JSON.parse(storedRecord({ mode: 'thinking', showReasoning: false }, 0)) as {
        state: { settings: Record<string, unknown> }
      }
      delete legacy.state.settings.thinkingChoice
      localStorage.setItem(AI_ASSISTANT_STORAGE_KEY, JSON.stringify(legacy))
      await useAiAssistantStore.persist.rehydrate()

      const settings = useAiAssistantStore.getState().settingsFor('7')
      expect(settings?.mode).toBe('thinking')
      expect(settings?.thinkingChoice).toBeNull()
      expect(settings?.showReasoning).toBe(false)
    })

    it('запись новой сборки читается старой схемой (version 0, без migrate) без потери полей', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      useAiAssistantStore.getState().setActiveConversation('7', 42)
      useAiAssistantStore.getState().saveSettings('7', {
        ...DEFAULT_ASSISTANT_SETTINGS,
        mode: 'thinking',
        responseMode: 'detailed',
        voiceMaxDurationSec: 30,
        thinkingChoice: 'off',
        showReasoning: false,
      })

      // Сборка до этой правки: та же запись, схема без thinkingChoice,
      // showReasoning — boolean, version 0 и никакого migrate.
      type LegacySettings = Omit<AssistantSettings, 'thinkingChoice'>
      type LegacyState = {
        userId: string | null
        conversationId: number | null
        settings: LegacySettings | null
        settingsFor: (userId: string | null) => LegacySettings | null
      }
      const legacyDefaults: LegacySettings = (({ thinkingChoice: _omit, ...rest }) => rest)(
        DEFAULT_ASSISTANT_SETTINGS
      )
      const useLegacyStore = create<LegacyState>()(
        persist(
          (_set, get) => ({
            userId: null,
            conversationId: null,
            settings: null,
            settingsFor: (userId) => {
              const state = get()
              if (userId == null || state.userId !== userId || state.settings == null) return null
              return { ...legacyDefaults, ...state.settings }
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
      await useLegacyStore.persist.rehydrate()

      const legacy = useLegacyStore.getState()
      expect(consoleError).not.toHaveBeenCalled()
      expect(legacy.conversationId).toBe(42)
      const settings = legacy.settingsFor('7')
      expect(settings).not.toBeNull()
      expect(settings?.mode).toBe('thinking')
      expect(settings?.responseMode).toBe('detailed')
      expect(settings?.voiceMaxDurationSec).toBe(30)
      // Прежний тумблер видимости старая сборка читает как раньше — boolean.
      expect(settings?.showReasoning).toBe(false)
      consoleError.mockRestore()
    })

    it('settingsFor хранит явный выбор и не подменяет null дефолтом', () => {
      useAiAssistantStore.getState().saveSettings('7', {
        ...DEFAULT_ASSISTANT_SETTINGS,
        thinkingChoice: 'on',
      })
      expect(useAiAssistantStore.getState().settingsFor('7')?.thinkingChoice).toBe('on')

      useAiAssistantStore.getState().saveSettings('7', {
        ...DEFAULT_ASSISTANT_SETTINGS,
        thinkingChoice: null,
      })
      expect(useAiAssistantStore.getState().settingsFor('7')?.thinkingChoice).toBeNull()
    })
  })
})
