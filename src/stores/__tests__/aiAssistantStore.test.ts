import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ASSISTANT_SETTINGS,
  useAiAssistantStore,
  AI_ASSISTANT_STORAGE_KEY,
} from '../aiAssistantStore'

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
    }
    expect(parsed.state.settings?.mode).toBe('thinking')
  })
})
