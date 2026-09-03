/**
 * KAN-1067 — where focus lands when the TA modal opens from a hotkey.
 *
 * The bug was never in the Enter rules: `decideEnterSave` correctly stands
 * aside for a focused button, because activating one AND saving would run two
 * actions from a single press. The defect was that the focused button was
 * MINIMIZE — it is the first focusable element in the dialog, and Modal.tsx
 * passes no `onOpenAutoFocus`, so Radix's default put the caret there.
 *
 * These tests therefore assert on `document.activeElement`, not on mutations
 * alone, and render a Minimize button ahead of the panel exactly as
 * ClientDetailPage does — without it the DOM has nothing for focus to land on
 * wrongly, and the test would pass against the bug.
 */
import { describe, expect, it, vi, afterAll, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
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
// Controllable so the two outer render guards — the loading skeleton and the
// "no chains" message — can be driven; Enter must not save behind either.
const chainList = { items: [chain] as unknown[], isLoading: false }

vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({ data: { items: chainList.items }, isLoading: chainList.isLoading }),
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
  chainList.items = [chain]
  chainList.isLoading = false
})

/**
 * Reproduces the real opening sequence in two mounts.
 *
 * Mount 1 is the modal chrome alone — Minimize and Close — with focus on
 * Minimize, which is where Radix leaves it: it is the first focusable element
 * in the dialog and Modal.tsx sets no `onOpenAutoFocus`.
 * Mount 2 adds the executor, whose Save is reachable straight away.
 *
 * Rendering both at once would be wrong in a way that HIDES the bug: the
 * executor mounts and focuses Save before the test can put focus on Minimize,
 * so the assertion would pass against code that does nothing.
 */
function openModal(initialTemplateId: number | null = null) {
  const chrome = (
    <>
      <button data-testid="minimize" aria-label="Minimize modal" />
      <button data-testid="close" aria-label="Close modal" />
    </>
  )
  const shell = (children: ReactNode) => (
    <div role="dialog" tabIndex={-1} data-testid="dialog">
      {chrome}
      {children}
    </div>
  )

  const { rerender } = render(shell(null))
  const minimize = screen.getByTestId('minimize') as HTMLButtonElement
  minimize.focus()
  expect(document.activeElement).toBe(minimize)

  const withExecutor = shell(
    <ChainExecutor clientId={100} clientName="Test client" initialTemplateId={initialTemplateId} />
  )
  rerender(withExecutor)

  return { minimize, rerender: () => rerender(withExecutor) }
}

describe('ChainExecutor — opening focus (KAN-1067)', () => {
  it('moves focus off Minimize and onto Save for a hotkey launch', async () => {
    const { minimize } = openModal(5)

    const save = await screen.findByRole('button', { name: /saveInteraction/i })
    await waitFor(() => expect(document.activeElement).toBe(save))
    expect(document.activeElement).not.toBe(minimize)
  })

  it('so the first Enter saves instead of minimizing', async () => {
    const user = userEvent.setup()
    openModal(5)

    const save = await screen.findByRole('button', { name: /saveInteraction/i })
    await waitFor(() => expect(document.activeElement).toBe(save))

    // No click, no tab — the operator's very first keystroke, which is the
    // whole complaint in the ticket.
    await user.keyboard('{Enter}')
    await waitFor(() => expect(createInteraction).toHaveBeenCalledTimes(1))
  })

  it('leaves a manual open alone', async () => {
    // Third criterion. Focus was never on Minimize in this flow in production,
    // and moving it here would be a new bug rather than a fix.
    const { minimize } = openModal(null)

    await screen.findByRole('button', { name: /saveInteraction/i })
    await waitFor(() => expect(document.activeElement).toBe(minimize))
  })

  it('does not grab focus again once the operator has moved on', async () => {
    // Latched to the opening. Save comes and goes as the wizard advances, and
    // re-focusing it on every reappearance would yank the caret out of
    // whatever the operator is typing in.
    const { rerender } = openModal(5)

    const save = await screen.findByRole('button', { name: /saveInteraction/i })
    await waitFor(() => expect(document.activeElement).toBe(save))

    const notes = document.querySelector('[data-ta-notes]') as HTMLTextAreaElement
    expect(notes).toBeTruthy()
    notes.focus()
    rerender()

    await waitFor(() => expect(document.activeElement).toBe(notes))
  })

  it('still lets Minimize be clicked normally', async () => {
    // Fourth criterion: the button keeps working, it just no longer starts
    // with the caret on it.
    const user = userEvent.setup()
    const onMinimize = vi.fn()
    render(
      <div role="dialog" tabIndex={-1}>
        <button data-testid="minimize" aria-label="Minimize modal" onClick={onMinimize} />
        <ChainExecutor clientId={100} clientName="Test client" initialTemplateId={5} />
      </div>
    )

    await screen.findByRole('button', { name: /saveInteraction/i })
    await user.click(screen.getByTestId('minimize'))
    expect(onMinimize).toHaveBeenCalledTimes(1)
  })
})
