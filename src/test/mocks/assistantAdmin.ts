/**
 * Assistant admin write API stubs for unit tests.
 *
 * Registered once from setup.ts so every test file shares the same `vi.fn`
 * instances (vitest `singleFork` pool) — same rationale as
 * src/test/mocks/assistantOverview.ts (a per-file `vi.mock` factory can
 * diverge from what the hook calls once another file re-registers it).
 */
import { vi } from 'vitest'

const mockUpdateAssistantSkill = vi.fn()
const mockUpdateAssistantPromptAppend = vi.fn()
const mockUpdateAssistantPersona = vi.fn()

export const assistantAdminTestMocks = {
  mockUpdateAssistantSkill,
  mockUpdateAssistantPromptAppend,
  mockUpdateAssistantPersona,
}

vi.mock('@/features/aiSettings/api/assistantAdminService', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/features/aiSettings/api/assistantAdminService')>()
  return {
    ...original,
    updateAssistantSkill: mockUpdateAssistantSkill,
    updateAssistantPromptAppend: mockUpdateAssistantPromptAppend,
    updateAssistantPersona: mockUpdateAssistantPersona,
  }
})
