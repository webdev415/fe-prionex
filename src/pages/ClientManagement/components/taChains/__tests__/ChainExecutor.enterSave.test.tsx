/**
 * KAN-974 — Enter-to-save through the ACTUAL ChainExecutor.
 *
 * The other tests in this folder cover the rules (`decideEnterSave`) and the
 * Radix integration through a hand-built harness. Neither touches the
 * component, and that gap is where every bug in this ticket lived: the wiring
 * looked right in a harness that did not have the app's shape.
 *
 * So this renders the real thing on a real last step and asserts the two
 * halves that a harness cannot: that `canSaveOnEnter` agrees with the Save
 * button actually on screen, and that Enter reaches the same mutation the
 * button does.
 */
import { describe, expect, it, vi, afterAll, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createInteraction = vi.fn().mockResolvedValue({ id: 1 })
const advanceInstance = vi.fn().mockResolvedValue({})

const chain = {
  id: 1,
  name: 'One step chain',
  description: null,
  chain_type: 'manual',
  department_ids: [1],
  is_active: true,
  is_system_hidden: false,
  is_pinned: false,
  step_count: 1,
  created_by: 1,
  created_at: '',
  updated_at: '',
  steps: [
    {
      id: 10,
      chain_id: 1,
      target_action_id: 3,
      target_action_name: 'Результат',
      target_action_field_type: 'dropdown',
      step_order: 1,
      is_required: false,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: null,
      show_closed_credits: false,
      position_x: null,
      position_y: null,
    },
  ],
}

const activeInstance = {
  id: 9,
  chain_id: 1,
  client_id: 100,
  status: 'active',
  current_step_order: 1,
  step_data: {},
  created_at: '',
  updated_at: '',
}

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useStartChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTAInteraction: () => ({ mutateAsync: createInteraction, isPending: false }),
  useAdvanceChainInstance: () => ({ mutateAsync: advanceInstance, isPending: false }),
  useClientChainInstances: () => ({ data: [activeInstance], isLoading: false }),
  useCancelChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClientPinnedChainIds: () => ({ data: [] }),
  useRewindChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({ data: { items: [chain] }, isLoading: false }),
  useTAChain: () => ({ data: chain }),
  usePinTAChain: () => ({ mutateAsync: vi.fn() }),
  useUnpinTAChain: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({
    data: {
      items: [
        {
          id: 3,
          name: 'Результат',
          field_type: 'dropdown',
          is_hidden: false,
          dropdown_values: [{ id: 7, value: 'Домовленість', sort_order: 0, is_hidden: false }],
        },
      ],
    },
  }),
}))
vi.mock('@/features/chainBuilder/hooks/useChainBuilder', () => ({
  useBuilderData: () => ({ data: { branches: [], effects: [], blockers: [] } }),
}))
vi.mock('@/features/quickPicks/hooks/useQuickPicks', () => ({
  useQuickPicks: () => ({ data: [] }),
}))
vi.mock('@/features/tags/hooks/useTags', () => ({ useTags: () => ({ data: [] }) }))
vi.mock('@/features/clients/hooks/useClientEmails', () => ({
  useClientEmails: () => ({ data: [] }),
}))
vi.mock('@/features/clients/hooks/useClientPhones', () => ({
  useClientPhones: () => ({ data: [] }),
}))
// Called both with and without a selector in this component, so the mock has
// to support each form rather than assuming one.
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: (s: unknown) => unknown) => {
    const state = { user: { active_project_id: '1', timezone: 'Europe/Kiev' } }
    return sel ? sel(state) : state
  },
}))
vi.mock('@/stores/chainExecutorStore', () => ({
  useChainExecutorStore: Object.assign(
    (sel?: (s: unknown) => unknown) => {
      const state = { minimized: null, setMinimized: vi.fn(), clear: vi.fn() }
      return sel ? sel(state) : state
    },
    { getState: () => ({ minimized: null }) }
  ),
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    // The second argument is a default string in some calls and an
    // interpolation object in others; only the string form is a default.
    useTranslation: () => ({
      t: (k: string, d?: unknown) => (typeof d === 'string' ? d : k),
      i18n: { language: 'en' },
    }),
  }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { ChainExecutor } from '../ChainExecutor'

// Held in a variable so a test can assert it is NOT consulted on ordinary
// typing — reading layout is the expensive part of the scoping check.
const getClientRects = vi.fn(() => [{ width: 100, height: 100 }] as unknown as DOMRectList)
const originalPrototypeMethods = {
  scrollIntoView: Element.prototype.scrollIntoView,
  hasPointerCapture: Element.prototype.hasPointerCapture,
  releasePointerCapture: Element.prototype.releasePointerCapture,
  setPointerCapture: Element.prototype.setPointerCapture,
  getClientRects: Element.prototype.getClientRects,
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  // jsdom lays nothing out, so the panel would read as off screen.
  Element.prototype.getClientRects = getClientRects
})

// Restored so these stubs cannot leak if file isolation is ever turned off.
afterAll(() => {
  Object.assign(Element.prototype, originalPrototypeMethods)
})

beforeEach(() => {
  createInteraction.mockClear()
  advanceInstance.mockClear()
  getClientRects.mockClear()
})

/** Wraps the executor the way the client card does: inside a role="dialog". */
function renderInDialog() {
  return render(
    <div role="dialog" tabIndex={-1} data-testid="dialog">
      <ChainExecutor clientId={100} clientName="Test client" />
    </div>
  )
}

describe('ChainExecutor — Enter to save (KAN-974)', () => {
  it('saves via the same mutation as the Save button, with focus on the dialog', async () => {
    const user = userEvent.setup()
    renderInDialog()

    // The premise: this really is a last step with a Save button on screen.
    // Without this the test could pass against a screen that cannot save.
    const saveButton = await screen.findByRole('button', { name: /saveInteraction/i })
    expect(saveButton).toBeInTheDocument()

    // Focus where Radix puts it when a modal opens — the wrapper, not the panel.
    screen.getByTestId('dialog').focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(createInteraction).toHaveBeenCalledTimes(1))
  })

  it('does not save from inside the notes field', async () => {
    const user = userEvent.setup()
    renderInDialog()
    await screen.findByRole('button', { name: /saveInteraction/i })

    const notes = document.querySelector('[data-ta-notes]') as HTMLTextAreaElement
    expect(notes).toBeTruthy()

    notes.focus()
    await user.keyboard('a{Enter}b')

    expect(createInteraction).not.toHaveBeenCalled()
    // And Enter did what it is supposed to do there.
    expect(notes.value).toBe('a\nb')
  })

  it('does not read layout while the operator is typing', async () => {
    // The scoping check forces a synchronous layout, so it must sit behind the
    // key test. Without that ordering every character typed into the notes
    // field reflows the page, once per mounted executor.
    const user = userEvent.setup()
    renderInDialog()
    await screen.findByRole('button', { name: /saveInteraction/i })

    const notes = document.querySelector('[data-ta-notes]') as HTMLTextAreaElement
    notes.focus()
    getClientRects.mockClear()

    await user.keyboard('hello')
    expect(getClientRects).not.toHaveBeenCalled()

    // ...and it still runs when the key actually matters.
    await user.keyboard('{Enter}')
    expect(getClientRects).toHaveBeenCalled()
  })

  it('does not save from a press outside the dialog', async () => {
    const user = userEvent.setup()
    renderInDialog()
    await screen.findByRole('button', { name: /saveInteraction/i })

    expect(document.activeElement).toBe(document.body)
    await user.keyboard('{Enter}')

    expect(createInteraction).not.toHaveBeenCalled()
  })
})
