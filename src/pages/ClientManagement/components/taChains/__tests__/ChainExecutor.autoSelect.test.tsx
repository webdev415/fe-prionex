/**
 * KAN-977 wizard-mode wiring — the half that unit tests cannot reach.
 *
 * The reset effect and the auto-select effect run in the SAME commit and both
 * read the render-time ``stepValue``. On a render where it was still '' — the
 * executor mounting onto an already-active instance, or a start served from a
 * warm contact cache — the auto-select sees an empty step and its setter lands
 * AFTER the reset's, silently discarding whatever the reset had chosen.
 *
 * ``taChainAutoSelect.ts`` documents and tests that a preset outranks the
 * auto-select, but that guarantee lives in the CALL SITE: the fix is
 * ``setStepValue((prev) => (prev ? prev : pick))``, which consults the value the
 * reset just queued instead of the stale one from the closure. Reverting it
 * breaks no unit test, which is why this file exists.
 *
 * The probe is ``prefilledPhone``, since it flows through the very same
 * ``setStepValue(preset ?? phonePrefill)`` line as a quick-pick preset but is a
 * plain prop — no template selection, no start mutation, no instance transition.
 * It is given a value NOT in the candidate list so the two outcomes are visually
 * distinguishable: with the fix no radio is checked (the step holds the prefill,
 * which is not among the options); without it, the sole candidate's radio is.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const PREFILL = '0500000001'
const CANDIDATE = '0509999999'

const CONTACT_TA = {
  id: 90,
  name: 'Телефон',
  field_type: 'contact',
  is_hidden: false,
  usage_count: 1,
  dropdown_values: [],
}

const CONTACT_STEP = {
  id: 55,
  chain_id: 7,
  target_action_id: 90,
  target_action_name: 'Телефон',
  step_order: 1,
  is_required: true,
  delay_minutes: 0,
  not_in_the_past: false,
  contact_source: 'client',
  contact_medium: 'phone',
  show_closed_credits: false,
}

const CHAIN = {
  id: 7,
  name: 'Стягнення: Контакт з клієнтом',
  chain_type: 'manual',
  is_active: true,
  is_system_hidden: false,
  steps: [CONTACT_STEP],
}

const ACTIVE_INSTANCE = {
  id: 900,
  chain_id: 7,
  chain_name: CHAIN.name,
  client_id: 3,
  status: 'active',
  current_step_order: 1,
  started_by: 1,
  started_at: '2026-08-10T09:00:00',
  completed_at: null,
  last_step_completed_at: null,
  delay_seconds_left: 0,
  step_data: null,
}

const usePhones = vi.fn()

vi.mock('@/features/clients/hooks/useClientPhones', () => ({
  useClientPhones: (...a: unknown[]) => usePhones(...a),
}))
vi.mock('@/features/clients/hooks/useClientEmails', () => ({
  useClientEmails: () => ({ data: undefined }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({ data: { items: [CHAIN] } }),
  useTAChain: () => ({ data: CHAIN }),
  usePinTAChain: () => ({ mutateAsync: vi.fn() }),
  useUnpinTAChain: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: [CONTACT_TA] } }),
}))
vi.mock('@/features/tags/hooks/useTags', () => ({ useTags: () => ({ data: [] }) }))
vi.mock('@/features/chainBuilder/hooks/useChainBuilder', () => ({
  useBuilderData: () => ({ data: { branches: [], triggers: [], blockers: [], effects: [] } }),
}))
vi.mock('@/features/quickPicks/hooks/useQuickPicks', () => ({
  useQuickPicks: () => ({ data: [] }),
}))
vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useClientChainInstances: () => ({ data: [ACTIVE_INSTANCE] }),
  useClientPinnedChainIds: () => ({ data: [] }),
  useStartChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTAInteraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdvanceChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRewindChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
// Called both as a selector (`useAuthStore(s => s.user)` in InstantStepCard)
// and bare (`const { user } = useAuthStore()` in ChainExecutor).
vi.mock('@/stores/authStore', () => {
  const state = {
    user: { id: 1, timezone: 'Europe/Kiev', permissions: [], active_department_id: null },
  }
  return {
    useAuthStore: (sel?: (s: typeof state) => unknown) => (sel ? sel(state) : state),
  }
})
vi.mock('@/stores/chainExecutorStore', () => ({
  useChainExecutorStore: () => ({ minimized: null, setMinimized: vi.fn(), clear: vi.fn() }),
}))

import { ChainExecutor } from '../ChainExecutor'

beforeEach(() => vi.clearAllMocks())

describe('ChainExecutor wizard — auto-select precedence', () => {
  it('does not overwrite the value the reset chose, even from a warm cache', () => {
    // Warm cache: the single candidate is present on the very first render, the
    // same render on which the reset applies the prefill.
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: CANDIDATE }] })

    render(
      <ChainExecutor
        clientId={3}
        clientName="Test"
        contactSource="client"
        prefilledPhone={PREFILL}
      />
    )

    // The step holds PREFILL, which is not one of the options — so the sole
    // candidate must NOT be checked. Without the functional update the
    // auto-select lands last and ticks it.
    const radio = screen.getByRole('radio', { name: new RegExp(CANDIDATE) })
    expect(radio).not.toBeChecked()
  })

  it('still auto-selects when the reset chose nothing', () => {
    // Same setup without a prefill: the step is genuinely empty, so the single
    // candidate should be selected. Guards against "fixing" the above by
    // disabling the feature.
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: CANDIDATE }] })

    render(<ChainExecutor clientId={3} clientName="Test" />)

    const radio = screen.getByRole('radio', { name: new RegExp(CANDIDATE) })
    expect(radio).toBeChecked()
  })
})
