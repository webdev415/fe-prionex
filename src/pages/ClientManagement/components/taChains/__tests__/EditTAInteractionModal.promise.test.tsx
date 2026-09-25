/**
 * KAN-1069 follow-up — the Edit Interaction modal no longer edits the promise
 * columns directly.
 *
 * Before KAN-1069, `promise_date` / `promise_amount` could only be set through
 * two standalone inputs at the bottom of this modal. Now the promise IS the
 * value of the chain steps the admin flagged, so those inputs showed the same
 * number twice — once as "Step N — Promise Amount", once in a box underneath —
 * and either copy could be edited, with the winner decided by whichever line of
 * code ran last.
 *
 * The dangerous half is the payload, not the markup. The modal used to send
 * `clear_promise_*: !value`, so removing the inputs while leaving that in place
 * would post `clear: true` on every save and wipe the promise — silently, and
 * unrecoverably for a chain whose steps are not flagged.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { setActiveCurrency } from '@/lib/projectCurrency'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const INTERACTION = {
  id: 1,
  client_id: 100,
  credit_id: null,
  chain_id: 1,
  chain_name: 'promise',
  chain_instance_id: null,
  leaf_node_id: null,
  dropdown_value_id: null,
  // The interaction HAS a promise — this is what used to make the standalone
  // inputs appear (`showPromiseDate = … || !!interaction?.promise_date`).
  promise_date: '2026-09-13T00:00:00',
  promise_amount: '340.00',
  notes: null,
  step_data: { '1': '2026-09-13T00:00:00Z', '2': '340' },
  created_at: '2026-09-13T10:00:00',
}

const CHAIN = {
  id: 1,
  name: 'promise',
  chain_type: 'manual',
  steps: [
    {
      id: 11,
      chain_id: 1,
      target_action_id: 3,
      target_action_name: 'When',
      target_action_field_type: 'date',
      step_order: 1,
      is_required: true,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: null,
      contact_medium: 'phone',
      show_closed_credits: false,
      is_promise_date: true,
      is_promise_amount: false,
      position_x: null,
      position_y: null,
    },
    {
      id: 12,
      chain_id: 1,
      target_action_id: 4,
      target_action_name: 'How much',
      target_action_field_type: 'amount',
      step_order: 2,
      is_required: true,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: null,
      contact_medium: 'phone',
      show_closed_credits: false,
      is_promise_date: false,
      is_promise_amount: true,
      position_x: null,
      position_y: null,
    },
  ],
}

const TARGET_ACTIONS = [
  { id: 3, name: 'When', field_type: 'date', is_hidden: false, dropdown_values: [] },
  { id: 4, name: 'How much', field_type: 'amount', is_hidden: false, dropdown_values: [] },
]

/**
 * The other kind of chain: no flagged steps, a promise that came from a
 * dropdown value's require_promise_* flags in ChainExecutor. The server
 * derives nothing for these — `tracked` is false and it leaves both columns
 * alone — so this modal is the only place such a promise can be fixed.
 */
const LEGACY_CHAIN = {
  id: 2,
  name: 'legacy',
  chain_type: 'manual',
  steps: [
    {
      id: 21,
      chain_id: 2,
      target_action_id: 5,
      target_action_name: 'Result',
      target_action_field_type: 'dropdown',
      step_order: 1,
      is_required: true,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: null,
      contact_medium: 'phone',
      show_closed_credits: false,
      is_promise_date: false,
      is_promise_amount: false,
      position_x: null,
      position_y: null,
    },
  ],
}

const LEGACY_TARGET_ACTIONS = [
  {
    id: 5,
    name: 'Result',
    field_type: 'dropdown',
    is_hidden: false,
    dropdown_values: [
      {
        id: 50,
        value: 'Promised to pay',
        require_promise_date: true,
        require_promise_amount: true,
        require_credit: false,
      },
    ],
  },
]

// Swapped per describe block — the hooks below read these, not the constants.
let activeChain: unknown = CHAIN
let activeTargetActions: unknown = TARGET_ACTIONS

const mutateAsync = vi.fn().mockResolvedValue({})

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useTAInteraction: () => ({ data: INTERACTION, isLoading: false }),
  useClientChainInstances: () => ({ data: [] }),
  useUpdateTAInteraction: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChain: () => ({ data: activeChain }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: activeTargetActions } }),
}))
vi.mock('@/features/clients/hooks/useClientEmails', () => ({
  useClientEmails: () => ({ data: [] }),
}))
vi.mock('@/features/clients/hooks/useClientPhones', () => ({
  useClientPhones: () => ({ data: [] }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: (s: unknown) => unknown) => {
    const state = { user: { active_project_id: '1', timezone: 'Europe/Kiev' } }
    return sel ? sel(state) : state
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, d?: unknown) => (typeof d === 'string' ? d : k),
      i18n: { language: 'en' },
    }),
  }
})

import { EditTAInteractionModal } from '../EditTAInteractionModal'

function setup() {
  mutateAsync.mockClear()
  return render(<EditTAInteractionModal open interactionId={1} onClose={vi.fn()} debts={[]} />)
}

/** The payload of the last save. */
function lastPayload(): Record<string, unknown> {
  return (mutateAsync.mock.calls.at(-1)?.[0] as { payload: Record<string, unknown> })?.payload
}

describe('Edit Interaction — the promise is the steps (KAN-1069 follow-up)', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    // A chain whose steps ARE flagged: the server derives the promise.
    activeChain = CHAIN
    activeTargetActions = TARGET_ACTIONS
  })

  it('shows no standalone promise inputs, even when the interaction has a promise', () => {
    setup()
    // The fixture carries promise_date AND promise_amount — the exact condition
    // that used to reveal both inputs.
    expect(screen.queryByLabelText(/promise date/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/promise amount/i)).not.toBeInTheDocument()
    expect(screen.queryByText('pages.clientChains.promiseDate')).not.toBeInTheDocument()
    expect(screen.queryByText('pages.clientChains.promiseAmountUAH')).not.toBeInTheDocument()
  })

  it('still shows the chain steps that hold those values', () => {
    setup()
    // Removing the duplicates must not remove the originals.
    expect(screen.getByText(/When/)).toBeInTheDocument()
    expect(screen.getByText(/How much/)).toBeInTheDocument()
  })

  it('never sends clear_promise_* — the wipe this change could have caused', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    const payload = lastPayload()

    // The inputs are gone, so their state would read empty and
    // `clear_promise_*: !value` would post `true` on every single save.
    expect(payload).not.toHaveProperty('clear_promise_date')
    expect(payload).not.toHaveProperty('clear_promise_amount')
  })

  it('does not write the promise columns directly at all', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    const payload = lastPayload()

    expect(payload).not.toHaveProperty('promise_date')
    expect(payload).not.toHaveProperty('promise_amount')
    // The step values still go, and the backend derives the promise from them.
    expect(payload).toHaveProperty('step_data')
  })

  it('leaves the credit field alone', async () => {
    // Credit shares the same "capabilities" mechanism the promise fields used;
    // only the promise halves were removed.
    setup()
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(lastPayload()).toHaveProperty('clear_credit_id')
  })
})

describe('Edit Interaction — a chain with no flagged steps (KAN-1069 review)', () => {
  /**
   * The other half of the contract, and the one the review caught.
   *
   * ChainExecutor still writes promise_date / promise_amount from a dropdown
   * value's require_promise_* flags. Those interactions have no flagged step,
   * so the server's derive pass reports `tracked: false` and leaves both
   * columns exactly as they were — nothing about editing step_data can reach
   * them. Removing these inputs outright left such a promise permanently
   * wrong, with no way to correct or clear it: the chain already holds
   * interactions, so it is structurally locked and cannot adopt the flags
   * without being cloned.
   */
  beforeEach(() => {
    mutateAsync.mockClear()
    activeChain = LEGACY_CHAIN
    activeTargetActions = LEGACY_TARGET_ACTIONS
  })

  it('still offers the standalone inputs, populated from the interaction', async () => {
    setup()

    const date = await screen.findByDisplayValue('2026-09-13')
    expect(date).toBeInTheDocument()
    expect(screen.getByDisplayValue('340.00')).toBeInTheDocument()
  })

  it('sends the corrected promise, because nothing else can', async () => {
    setup()

    const amount = await screen.findByDisplayValue('340.00')
    fireEvent.change(amount, { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(lastPayload().promise_amount).toBe(500)
    expect(lastPayload().clear_promise_amount).toBe(false)
  })

  it('can clear a promise outright', async () => {
    setup()

    const amount = await screen.findByDisplayValue('340.00')
    fireEvent.change(amount, { target: { value: '' } })
    const date = screen.getByDisplayValue('2026-09-13')
    fireEvent.change(date, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(lastPayload().clear_promise_date).toBe(true)
    expect(lastPayload().clear_promise_amount).toBe(true)
    expect(lastPayload().promise_amount).toBeUndefined()
  })
})

describe('Edit Interaction — the promise amount carries the project currency', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    activeChain = LEGACY_CHAIN
    activeTargetActions = LEGACY_TARGET_ACTIONS
  })

  afterEach(() => {
    setActiveCurrency('UAH')
  })

  it('marks the standalone amount with the euro sign in a euro project', async () => {
    setActiveCurrency('EUR')
    setup()

    await screen.findByDisplayValue('340.00')
    expect(screen.getAllByText('€').length).toBeGreaterThan(0)
    expect(screen.queryByText('₴')).not.toBeInTheDocument()
  })

  it('keeps the hryvnia sign in a hryvnia project', async () => {
    setup()

    await screen.findByDisplayValue('340.00')
    expect(screen.getAllByText('₴').length).toBeGreaterThan(0)
  })
})
