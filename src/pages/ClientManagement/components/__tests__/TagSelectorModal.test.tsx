/**
 * TagSelectorModal — the onTagsChanged contract.
 *
 * The callback arms auto-open of the chain executor for THIS operator, on a
 * 15s window of 1.5s polling. Its JSDoc promises it is "Not called when nothing
 * changed or the save failed", and the wiring did not honour the first half:
 * Promise.all([]) resolves, so an unchanged save reached the success branch and
 * armed anyway. That matters beyond wasted requests -- every armed window is one
 * in which a chain launched by somebody else (a colleague, a scheduled trigger)
 * is attributed to this operator and pops the executor over their work.
 *
 * Cases, one per clause of that contract:
 *   - a real change  -> called exactly once
 *   - nothing changed -> never called
 *   - a write fails   -> never called
 *   - only a protected tag the operator may not remove -> never called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TagSelectorModal } from '../TagSelectorModal'
import type { TagDefinition } from '@/features/tags/types'

// --- mocks ------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object' && 'defaultValue' in opts) {
        return (opts as { defaultValue: string }).defaultValue
      }
      return key
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const assignSpy = vi.hoisted(() => vi.fn())
const removeSpy = vi.hoisted(() => vi.fn())
const clientTagsRef = vi.hoisted(() => ({ current: [] as TagDefinition[] }))
const catalogRef = vi.hoisted(() => ({ current: [] as TagDefinition[] }))

vi.mock('@/features/tags/hooks/useTags', () => ({
  useTags: () => ({ data: catalogRef.current, isLoading: false }),
  useClientTags: () => ({ data: clientTagsRef.current, isLoading: false }),
  useAssignClientTag: () => ({ mutateAsync: assignSpy, isPending: false }),
  useRemoveClientTag: () => ({ mutateAsync: removeSpy, isPending: false }),
}))

// Every user in these tests may remove protected tags unless a case says
// otherwise; the protected path has its own case below.
const roleRef = vi.hoisted(() => ({ current: 'Admin' }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = { user: { role_name: roleRef.current }, activeRoleName: roleRef.current }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/hooks', () => ({
  useHasPermission: () => true,
  useDebounce: (v: unknown) => v,
}))

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (v: unknown) => v,
}))

// The payload-tag branch opens a separate dialog and is out of scope here.
vi.mock('../PromiseAssignDialog', () => ({
  PromiseAssignDialog: () => null,
}))

// --- helpers ----------------------------------------------------------------

function tag(id: number, name: string, extra: Partial<TagDefinition> = {}): TagDefinition {
  return {
    id,
    name,
    code: name.toLowerCase().replace(/\s+/g, '_'),
    color: '#123456',
    is_protected: false,
    requires_payload: false,
    ...extra,
  } as TagDefinition
}

function renderModal(onTagsChanged: () => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TagSelectorModal
        clientId={42}
        clientName="Test Client"
        projectId={1}
        open
        onClose={vi.fn()}
        onTagsChanged={onTagsChanged}
      />
    </QueryClientProvider>
  )
}

async function save() {
  const buttons = screen.getAllByRole('button')
  const saveBtn = buttons[buttons.length - 1]
  await userEvent.click(saveBtn)
}

// --- tests ------------------------------------------------------------------

describe('TagSelectorModal onTagsChanged contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignSpy.mockResolvedValue(undefined)
    removeSpy.mockResolvedValue(undefined)
    roleRef.current = 'Admin'
    catalogRef.current = [tag(1, 'Alpha First'), tag(2, 'Zulu Related')]
    clientTagsRef.current = []
  })

  it('fires once when a tag is actually assigned', async () => {
    const onTagsChanged = vi.fn()
    renderModal(onTagsChanged)

    await userEvent.click(screen.getByText('Alpha First'))
    await save()

    await waitFor(() => expect(assignSpy).toHaveBeenCalledTimes(1))
    expect(onTagsChanged).toHaveBeenCalledTimes(1)
  })

  it('does not fire when the selection is unchanged', async () => {
    // The regression: Promise.all([]) resolves, so this reached the success
    // branch and armed a 15s poll for a save that wrote nothing.
    const onTagsChanged = vi.fn()
    clientTagsRef.current = [tag(1, 'Alpha First')]
    renderModal(onTagsChanged)

    await save()

    await waitFor(() => expect(onTagsChanged).not.toHaveBeenCalled())
    expect(assignSpy).not.toHaveBeenCalled()
    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('does not fire when a write rejects', async () => {
    const onTagsChanged = vi.fn()
    assignSpy.mockRejectedValue(new Error('boom'))
    renderModal(onTagsChanged)

    await userEvent.click(screen.getByText('Alpha First'))
    await save()

    await waitFor(() => expect(assignSpy).toHaveBeenCalled())
    expect(onTagsChanged).not.toHaveBeenCalled()
  })

  it('does not fire when the only change was blocked as protected', async () => {
    // allowedToRemove comes back empty, the error toast fires, and nothing is
    // written -- so there is nothing for a chain trigger to react to.
    const onTagsChanged = vi.fn()
    roleRef.current = 'Operator'
    catalogRef.current = [tag(1, 'Alpha First', { is_protected: true })]
    clientTagsRef.current = [tag(1, 'Alpha First', { is_protected: true })]
    renderModal(onTagsChanged)

    await userEvent.click(screen.getByText('Alpha First'))
    await save()

    await waitFor(() => expect(removeSpy).not.toHaveBeenCalled())
    expect(onTagsChanged).not.toHaveBeenCalled()
  })
})
