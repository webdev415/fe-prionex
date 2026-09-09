import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ASSISTANT_SETTINGS,
  useAiAssistantStore,
  AI_ASSISTANT_STORAGE_KEY,
  AI_ASSISTANT_STORAGE_VERSION,
  isReasoningShown,
  migrateAiAssistantState,
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

  describe('тумблер «Міркування 31B» (showReasoning)', () => {
    it('по умолчанию не выбран (null): поле thinking сервер решает сам, раздумья показываются', () => {
      expect(DEFAULT_ASSISTANT_SETTINGS.showReasoning).toBeNull()
      expect(isReasoningShown(null)).toBe(true)
      expect(isReasoningShown(true)).toBe(true)
      expect(isReasoningShown(false)).toBe(false)
      // Настроек нет вовсе (первый вход) — тоже показываем.
      expect(isReasoningShown(undefined)).toBe(true)
    })

    it('migrate v0→v1: прежнее true («показывать, если пришло») становится null', () => {
      const migrated = migrateAiAssistantState(
        JSON.parse(storedRecord({ showReasoning: true }, 0)).state,
        0
      ) as { settings: { showReasoning: unknown; mode: string } }
      expect(migrated.settings.showReasoning).toBeNull()
      // Остальные настройки записи не трогаются.
      expect(migrated.settings.mode).toBe('fast')
    })

    it('migrate v0→v1: явное false остаётся false', () => {
      const migrated = migrateAiAssistantState(
        JSON.parse(storedRecord({ showReasoning: false }, 0)).state,
        0
      ) as { settings: { showReasoning: unknown } }
      expect(migrated.settings.showReasoning).toBe(false)
    })

    it('migrate: запись текущей версии и записи без настроек возвращаются как есть', () => {
      const current = JSON.parse(storedRecord({ showReasoning: true }, 1)).state
      expect(migrateAiAssistantState(current, AI_ASSISTANT_STORAGE_VERSION)).toBe(current)
      const noSettings = { userId: null, conversationId: null, settings: null }
      expect(migrateAiAssistantState(noSettings, 0)).toBe(noSettings)
      expect(migrateAiAssistantState(undefined, 0)).toBeUndefined()
    })

    it('rehydrate поднимает запись старого фронта через миграцию и пишет назад новую версию', async () => {
      localStorage.setItem(
        AI_ASSISTANT_STORAGE_KEY,
        storedRecord({ mode: 'thinking', showReasoning: true }, 0)
      )
      await useAiAssistantStore.persist.rehydrate()

      const settings = useAiAssistantStore.getState().settingsFor('7')
      expect(settings?.mode).toBe('thinking')
      expect(settings?.showReasoning).toBeNull()

      // Любая запись после миграции идёт уже под новой версией.
      useAiAssistantStore.getState().saveSettings('7', { ...settings!, showReasoning: false })
      const parsed = JSON.parse(localStorage.getItem(AI_ASSISTANT_STORAGE_KEY) as string) as {
        state: { settings: { showReasoning: unknown } | null }
        version: number
      }
      expect(parsed.version).toBe(AI_ASSISTANT_STORAGE_VERSION)
      expect(parsed.state.settings?.showReasoning).toBe(false)
    })

    it('settingsFor не подменяет сохранённый null дефолтом и хранит явный выбор', () => {
      useAiAssistantStore.getState().saveSettings('7', {
        ...DEFAULT_ASSISTANT_SETTINGS,
        showReasoning: null,
      })
      expect(useAiAssistantStore.getState().settingsFor('7')?.showReasoning).toBeNull()

      useAiAssistantStore.getState().saveSettings('7', {
        ...DEFAULT_ASSISTANT_SETTINGS,
        showReasoning: true,
      })
      expect(useAiAssistantStore.getState().settingsFor('7')?.showReasoning).toBe(true)
    })
  })
})
