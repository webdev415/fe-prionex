/**
 * Global assistant overview API stub for unit tests.
 *
 * Registered once from setup.ts so every test file shares the same `vi.fn`
 * instance (vitest `singleFork` pool) — same rationale as
 * src/test/mocks/aiAssistantSettings.ts (a per-file `vi.mock` factory can
 * diverge from what the hook calls once another file re-registers it).
 */
import { vi } from 'vitest'

const mockGetAssistantOverview = vi.fn()

export const assistantOverviewTestMocks = {
  mockGetAssistantOverview,
}

vi.mock('@/features/aiSettings/api/assistantOverviewService', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/features/aiSettings/api/assistantOverviewService')>()
  return {
    ...original,
    getAssistantOverview: mockGetAssistantOverview,
  }
})
