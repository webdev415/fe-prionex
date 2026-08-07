/**
 * Global Call QA API stubs for unit tests.
 *
 * Registered once from setup.ts so every test file shares the same `vi.fn`
 * instances (vitest `singleFork` pool). Per-file `vi.fn()` inside `vi.mock`
 * factories can diverge from what hooks call after another file re-registers
 * the mock — that left CallQaSettingsSection stuck in `isLoading` under full
 * suite runs.
 */
import { vi } from 'vitest'

const mockGetCallQaSettings = vi.fn()
const mockUpdateCallQaSettings = vi.fn()
const callQaAuthState = { isAuthenticated: true }

export const callQaSettingsTestMocks = {
  mockGetCallQaSettings,
  mockUpdateCallQaSettings,
  callQaAuthState,
}

vi.mock('@/features/quality/api/callQaSettingsService', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/features/quality/api/callQaSettingsService')>()
  return {
    ...original,
    getCallQaSettings: mockGetCallQaSettings,
    updateCallQaSettings: mockUpdateCallQaSettings,
  }
})
