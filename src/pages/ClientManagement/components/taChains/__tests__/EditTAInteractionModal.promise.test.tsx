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

import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const mutateAsync = vi.fn().mockResolvedValue({})

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useTAInteraction: () => ({ data: INTERACTION, isLoading: false }),
  useClientChainInstances: () => ({ data: [] }),
  useUpdateTAInteraction: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChain: () => ({ data: CHAIN }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: TARGET_ACTIONS } }),
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
  beforeEach(() => mutateAsync.mockClear())

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
