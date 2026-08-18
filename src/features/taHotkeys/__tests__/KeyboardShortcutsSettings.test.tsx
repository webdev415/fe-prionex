/**
 * KAN-975 — the settings tab, driven through the real components.
 *
 * The rules live in `shortcutRecorder` and are unit-tested there. This covers
 * what only a rendered screen can: that a recorded combination reaches the
 * save call in its canonical form, that the conflict warning names the right
 * template, and that Remove clears the row it belongs to.
 */
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const assignMutate = vi.fn().mockResolvedValue({
  hotkey: 'Ctrl+1',
  quick_pick_id: 10,
  reassigned_from: null,
})
const clearMutate = vi.fn().mockResolvedValue(undefined)

const QUICK_PICKS = [
  {
    id: 10,
    chain_id: 1,
    chain_name: 'Contact with Client (old)',
    name: 'Messenger — Restructuring',
    department_ids: [2],
    sort_order: 1,
    preset_values: { '1': 'Messenger', '3': 'Agreement' },
  },
  {
    id: 11,
    chain_id: 1,
    chain_name: 'Contact with Client (old)',
    name: 'Messenger — Refusal',
    department_ids: [2],
    sort_order: 2,
    preset_values: null,
  },
]

let bindings: Array<{ hotkey: string; quick_pick_id: number }> = []

vi.mock('@/features/quickPicks/hooks/useQuickPicks', () => ({
  useQuickPicks: () => ({ data: QUICK_PICKS, isLoading: false }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({
    data: {
      items: [
        { id: 1, name: 'Channel', field_type: 'dropdown', is_hidden: false, dropdown_values: [] },
        { id: 3, name: 'Result', field_type: 'dropdown', is_hidden: false, dropdown_values: [] },
      ],
    },
  }),
}))
vi.mock('../hooks/useTAHotkeys', () => ({
  useTAHotkeyList: () => ({ data: bindings }),
  useAssignTAHotkey: () => ({ mutateAsync: assignMutate, isPending: false }),
  useClearTAHotkey: () => ({ mutateAsync: clearMutate, isPending: false }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: (s: unknown) => unknown) => {
    const state = { user: { permissions: ['manage_settings'], active_department_id: null } }
    return sel ? sel(state) : state
  },
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      // Mirrors i18next: a string second argument is the default, an object is
      // interpolation, and `defaultValue` inside it is the template.
      t: (k: string, d?: unknown) => {
        if (typeof d === 'string') return d
        if (d && typeof d === 'object' && 'defaultValue' in d) {
          const { defaultValue, ...vars } = d as Record<string, string>
          return String(defaultValue).replace(/\{\{(\w+)\}\}/g, (_, n) => vars[n] ?? '')
        }
        return k
      },
      i18n: { language: 'en' },
    }),
  }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { KeyboardShortcutsSettings } from '../components/KeyboardShortcutsSettings'

const originals = {
  scrollIntoView: Element.prototype.scrollIntoView,
  hasPointerCapture: Element.prototype.hasPointerCapture,
  releasePointerCapture: Element.prototype.releasePointerCapture,
  setPointerCapture: Element.prototype.setPointerCapture,
}

beforeAll(() => {
  // Radix Select drives a real popup; jsdom implements none of this.
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
})
afterAll(() => Object.assign(Element.prototype, originals))

beforeEach(() => {
  assignMutate.mockClear()
  clearMutate.mockClear()
  bindings = []
})

function row(name: string) {
  return screen.getByText(name).closest('div.rounded-lg') as HTMLElement
}

describe('KeyboardShortcutsSettings', () => {
  it('lists templates with their stage and preset chips', () => {
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText('Messenger — Restructuring')).toBeInTheDocument()
    expect(screen.getAllByText(/Stage: Contact with Client \(old\)/)).toHaveLength(2)
    // Chips are the preset values labelled by their target action.
    expect(screen.getByText('Channel: Messenger')).toBeInTheDocument()
    expect(screen.getByText('Result: Agreement')).toBeInTheDocument()
  })

  it('records a combination and saves it in canonical form', async () => {
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    await user.click(within(row('Messenger — Restructuring')).getByText('+ Assign shortcut'))

    const recorder = screen.getByRole('button', { name: 'Shortcut recorder' })
    await user.click(recorder)
    await user.keyboard('{Control>}1{/Control}')

    // Displayed spaced, stored canonical — the two must not drift.
    expect(recorder).toHaveTextContent('Ctrl + 1')

    await user.click(screen.getByRole('button', { name: 'Save Shortcut' }))
    await waitFor(() =>
      expect(assignMutate).toHaveBeenCalledWith({ hotkey: 'Ctrl+1', quick_pick_id: 10 })
    )
  })

  it('warns which template already owns the combination, without blocking save', async () => {
    bindings = [{ hotkey: 'Ctrl+1', quick_pick_id: 10 }]
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    await user.click(within(row('Messenger — Refusal')).getByText('+ Assign shortcut'))
    await user.click(screen.getByRole('button', { name: 'Shortcut recorder' }))
    await user.keyboard('{Control>}1{/Control}')

    expect(
      screen.getByText('Already used by "Messenger — Restructuring". Saving will reassign it here.')
    ).toBeInTheDocument()
    // A warning, not a block (KAN-975 §4).
    expect(screen.getByRole('button', { name: 'Save Shortcut' })).toBeEnabled()
  })

  it('does not warn when re-recording onto the template that already has it', async () => {
    bindings = [{ hotkey: 'Ctrl+1', quick_pick_id: 10 }]
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    await user.click(within(row('Messenger — Restructuring')).getByLabelText('Edit'))
    await user.click(screen.getByRole('button', { name: 'Shortcut recorder' }))
    await user.keyboard('{Control>}1{/Control}')

    expect(screen.queryByText(/Already used by/)).not.toBeInTheDocument()
  })

  it('shows the assigned keys as separate pills', () => {
    bindings = [{ hotkey: 'Ctrl+1', quick_pick_id: 10 }]
    render(<KeyboardShortcutsSettings />)
    const assigned = row('Messenger — Restructuring')
    expect(within(assigned).getByText('Ctrl')).toBeInTheDocument()
    expect(within(assigned).getByText('1')).toBeInTheDocument()
  })

  it('clears the shortcut for the row whose Remove was clicked', async () => {
    bindings = [
      { hotkey: 'Ctrl+1', quick_pick_id: 10 },
      { hotkey: 'Alt+2', quick_pick_id: 11 },
    ]
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    await user.click(within(row('Messenger — Refusal')).getByLabelText('Remove'))
    await waitFor(() => expect(clearMutate).toHaveBeenCalledWith(11))
  })

  it('keeps Save disabled until a template and a combination are both chosen', async () => {
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    const save = screen.getByRole('button', { name: 'Save Shortcut' })
    expect(save).toBeDisabled()

    await user.click(within(row('Messenger — Restructuring')).getByText('+ Assign shortcut'))
    expect(save).toBeDisabled() // template chosen, nothing recorded yet
  })
})
