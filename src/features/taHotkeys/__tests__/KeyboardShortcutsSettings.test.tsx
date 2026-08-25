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
    preset_values: { '1': 'Messenger', '3': 'Agreement', '6': 'Домовленість' },
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

// Both quick picks above hang off chain 1. The screen only offers templates
// whose chain the executor can actually start, so the chain list has to be
// present or every row is (correctly) filtered away.
let chains: Array<{ id: number; chain_type: string }> = [{ id: 1, chain_type: 'manual' }]

// The screen distinguishes "no shortcuts" from "could not load them", so the
// hook mock has to carry the query state, not just the data.
let bindingsFailed = false
let chainsFailed = false
let clearPendingFor: number | null = null
const refetchBindings = vi.fn()
const refetchChains = vi.fn()

vi.mock('@/features/quickPicks/hooks/useQuickPicks', () => ({
  useQuickPicks: () => ({ data: QUICK_PICKS, isLoading: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({
    data: chainsFailed ? undefined : { items: chains },
    isLoading: false,
    isError: chainsFailed,
    refetch: refetchChains,
  }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({
    data: {
      items: [
        { id: 1, name: 'Channel', field_type: 'dropdown', is_hidden: false, dropdown_values: [] },
        { id: 3, name: 'Result', field_type: 'dropdown', is_hidden: false, dropdown_values: [] },
        {
          id: 6,
          name: 'Клієнт: Результат',
          field_type: 'dropdown',
          is_hidden: false,
          dropdown_values: [],
        },
      ],
    },
  }),
}))
vi.mock('../hooks/useTAHotkeys', () => ({
  useTAHotkeyList: () => ({
    data: bindings,
    isError: bindingsFailed,
    isLoading: false,
    refetch: refetchBindings,
  }),
  useAssignTAHotkey: () => ({ mutateAsync: assignMutate, isPending: false }),
  useClearTAHotkey: () => ({
    mutateAsync: clearMutate,
    isPending: clearPendingFor !== null,
    variables: clearPendingFor ?? undefined,
  }),
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
  chains = [{ id: 1, chain_type: 'manual' }]
  bindingsFailed = false
  chainsFailed = false
  clearPendingFor = null
  refetchBindings.mockClear()
  refetchChains.mockClear()
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

  it('separates the value with a dash when the action name already has a colon', () => {
    // Several real action names are paths — "Клієнт: Результат" — and appending
    // another colon produced "Клієнт: Результат: Домовленість".
    render(<KeyboardShortcutsSettings />)
    expect(screen.getByText('Клієнт: Результат — Домовленість')).toBeInTheDocument()
    // Plain names keep the colon.
    expect(screen.getByText('Channel: Messenger')).toBeInTheDocument()
  })

  it('filters the list by name, stage or chip', async () => {
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    const search = screen.getByPlaceholderText('Search templates…')
    await user.type(search, 'refusal')
    expect(screen.getByText('Messenger — Refusal')).toBeInTheDocument()
    expect(screen.queryByText('Messenger — Restructuring')).not.toBeInTheDocument()

    // A chip value finds a row the operator remembers by what it does.
    await user.clear(search)
    await user.type(search, 'agreement')
    expect(screen.getByText('Messenger — Restructuring')).toBeInTheDocument()
    expect(screen.queryByText('Messenger — Refusal')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'zzzz')
    expect(screen.getByText('No templates match your search.')).toBeInTheDocument()
  })

  it('hides templates the executor cannot start', async () => {
    // ChainExecutor keeps only quick picks on an active manual chain. A
    // template outside that set resolves on keypress, opens the modal and then
    // starts nothing — so offering it here invites the operator to bind a key
    // that does nothing, with no error to explain it.
    chains = [{ id: 1, chain_type: 'automatic' }]
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    expect(screen.queryByText('Messenger — Restructuring')).not.toBeInTheDocument()
    expect(screen.getByText('No templates are available to you.')).toBeInTheDocument()

    // And not through the assign panel's dropdown either, which is the second
    // way into a binding.
    await user.click(screen.getByRole('combobox'))
    expect(screen.queryByText('Messenger — Refusal')).not.toBeInTheDocument()
  })

  it('keeps showing a template that lost its chain but still holds a shortcut', () => {
    // Deactivating the chain must not take the binding off the screen: the
    // server still honours it, so a hidden row means a combination the
    // operator can neither see nor clear, which returns later as a surprise
    // reassignment. Remove is the whole point of the row.
    chains = [{ id: 1, chain_type: 'automatic' }]
    bindings = [{ hotkey: 'Ctrl+1', quick_pick_id: 10 }]
    render(<KeyboardShortcutsSettings />)

    const dead = row('Messenger — Restructuring')
    expect(within(dead).getByText(/no longer available/i)).toBeInTheDocument()
    expect(within(dead).getByLabelText('Remove')).toBeInTheDocument()
    // Editing it would only move a dead key onto another dead key.
    expect(within(dead).queryByLabelText('Edit')).not.toBeInTheDocument()
    // The template with no binding stays hidden.
    expect(screen.queryByText('Messenger — Refusal')).not.toBeInTheDocument()
  })

  it('says so when the shortcut list could not be loaded, and pauses assigning', async () => {
    // Falling back to an empty list makes a failed fetch look exactly like
    // "nothing assigned": no badges, no conflict warning, and a save that
    // quietly takes a combination off a template nobody was warned about.
    bindingsFailed = true
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i)
    // The way into the recorder is closed while the truth is unknown.
    expect(screen.getByRole('combobox')).toBeDisabled()
    for (const btn of screen.getAllByText('+ Assign shortcut')) {
      expect(btn).toBeDisabled()
    }

    await user.click(screen.getByText('Retry'))
    expect(refetchBindings).toHaveBeenCalled()
  })

  it('does not mistake a failed chain fetch for an empty chain list', async () => {
    // The chains endpoint is permission gated, so a 403 is reachable. Filtering
    // against the empty set that a failure leaves behind would hide every
    // template under "No templates are available to you" — an error dressed up
    // as a real empty state, which is the fault the banner exists to prevent.
    chainsFailed = true
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    expect(screen.getByText('Messenger — Restructuring')).toBeInTheDocument()
    expect(screen.queryByText('No templates are available to you.')).not.toBeInTheDocument()
    // Nothing is claimed about launchability while it is unknown.
    expect(screen.queryByText(/no longer available/i)).not.toBeInTheDocument()
    // But recording stays closed, and the banner says why.
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeDisabled()

    await user.click(screen.getByText('Retry'))
    expect(refetchChains).toHaveBeenCalled()
    // The healthy query is left alone.
    expect(refetchBindings).not.toHaveBeenCalled()
  })

  it('disables only the row whose shortcut is being removed', () => {
    // `isPending` is shared mutation state, so using it alone greys out every
    // row's Remove while one request is in flight.
    bindings = [
      { hotkey: 'Ctrl+1', quick_pick_id: 10 },
      { hotkey: 'Ctrl+2', quick_pick_id: 11 },
    ]
    clearPendingFor = 10
    render(<KeyboardShortcutsSettings />)

    expect(within(row('Messenger — Restructuring')).getByLabelText('Remove')).toBeDisabled()
    expect(within(row('Messenger — Refusal')).getByLabelText('Remove')).toBeEnabled()
  })

  it('still names a hidden template in the conflict warning', async () => {
    // The warning is built from every template, not the filtered set, or a
    // search would turn it into 'Already used by "#10"'.
    bindings = [{ hotkey: 'Ctrl+1', quick_pick_id: 10 }]
    const user = userEvent.setup()
    render(<KeyboardShortcutsSettings />)

    await user.type(screen.getByPlaceholderText('Search templates…'), 'refusal')
    await user.click(within(row('Messenger — Refusal')).getByText('+ Assign shortcut'))
    await user.click(screen.getByRole('button', { name: 'Shortcut recorder' }))
    await user.keyboard('{Control>}1{/Control}')

    expect(
      screen.getByText('Already used by "Messenger — Restructuring". Saving will reassign it here.')
    ).toBeInTheDocument()
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
