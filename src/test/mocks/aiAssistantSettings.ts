/**
 * Global AI assistant settings API stubs for unit tests.
 *
 * Registered once from setup.ts so every test file shares the same `vi.fn`
 * instances (vitest `singleFork` pool). Per-file `vi.fn()` inside `vi.mock`
 * factories can diverge from what hooks call after another file re-registers
 * the mock — that left CallQaSettingsSection stuck in `isLoading` under full
 * suite runs (mirrored here for AssistantSettingsSection).
 */
import { vi } from 'vitest'

const mockGetAiAssistantSettings = vi.fn()
const mockUpdateAiAssistantSettings = vi.fn()
const aiAssistantSettingsAuthState = { isAuthenticated: true }

export const aiAssistantSettingsTestMocks = {
  mockGetAiAssistantSettings,
  mockUpdateAiAssistantSettings,
  aiAssistantSettingsAuthState,
}

vi.mock('@/features/aiSettings/api/aiAssistantSettingsService', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/features/aiSettings/api/aiAssistantSettingsService')>()
  return {
    ...original,
    getAiAssistantSettings: mockGetAiAssistantSettings,
    updateAiAssistantSettings: mockUpdateAiAssistantSettings,
  }
})
