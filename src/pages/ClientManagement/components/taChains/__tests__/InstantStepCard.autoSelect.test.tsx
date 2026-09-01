/**
 * KAN-977 wiring test for all-at-once mode.
 *
 * ``pickSingleContactCandidate`` is unit-tested separately; every defect found
 * in review lived in the effect around it, not the rule. Specifically:
 *
 *  1. The card mounts in the same commit where ``selectedChainId`` changes, and
 *     React flushes child effects before parent ones. With a warm contact cache
 *     the list is populated on the first render, so the card picks and queues a
 *     functional ``setInstantValues`` — then the parent's selection reset queues
 *     a plain ``setInstantValues({})`` that lands last and discards it. Latching
 *     at pick time made that permanent: the feature silently no-opped after any
 *     chain switch. Covered by "retries after the parent discards the pick".
 *
 *  2. Restoring a minimized session remounts these cards with the persisted
 *     values. A step the operator deliberately unticked returns as ``value: ''``,
 *     indistinguishable from never-visited, so a fresh latch re-ticked it.
 *     Covered by "does not re-select a step the operator cleared".
 *
 * The card is rendered in isolation — it only needs the two contact hooks
 * mocked, not the whole ChainExecutor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const usePhones = vi.fn()
const useEmails = vi.fn()

vi.mock('@/features/clients/hooks/useClientPhones', () => ({
  useClientPhones: (...a: unknown[]) => usePhones(...a),
}))
vi.mock('@/features/clients/hooks/useClientEmails', () => ({
  useClientEmails: (...a: unknown[]) => useEmails(...a),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { timezone: 'Europe/Kiev' } }),
}))

import { InstantStepCard } from '../ChainExecutor'

const PHONE = '0501234567'
const EMPTY = { value: '', dropdownValueId: null, promiseDate: '', promiseAmount: '', creditId: '' }

const contactStep = {
  id: 55,
  chain_id: 7,
  target_action_id: 90,
  step_order: 10,
  contact_source: 'client',
  contact_medium: 'phone',
  is_required: true,
  delay_minutes: 0,
  not_in_the_past: false,
  show_closed_credits: false,
} as never

const contactTa = {
  id: 90,
  name: 'Телефон',
  field_type: 'contact',
  is_hidden: false,
  usage_count: 1,
  dropdown_values: [],
} as never

type CardProps = React.ComponentProps<typeof InstantStepCard>
type Overrides = Partial<CardProps>

const card = (over: Overrides, onChange: CardProps['onChange']) => (
  <InstantStepCard
    index={0}
    step={contactStep}
    ta={contactTa}
    value={EMPTY as never}
    onChange={onChange}
    debts={[]}
    clientId={3}
    hasPriorEntry={false}
    selectionSettled
    {...over}
  />
)

function renderCard(over: Overrides = {}) {
  const onChange = vi.fn()
  const utils = render(card(over, onChange))
  return { onChange, card: (o: Overrides = over) => card(o, onChange), ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
  useEmails.mockReturnValue({ data: undefined })
})

describe('InstantStepCard — single-candidate auto-select', () => {
  it('selects the only phone once the list resolves', () => {
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: PHONE, type_name: 'Мобільний' }] })

    const { onChange } = renderCard()

    expect(onChange).toHaveBeenCalledWith({ value: PHONE })
  })

  it('selects immediately when the list is already cached on first render', () => {
    // The warm-cache path — this is the render on which the parent's selection
    // reset has not run yet.
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: PHONE }] })

    const { onChange } = renderCard()

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('waits for the parent selection reset before picking', () => {
    // Finding 1, first half. On the commit where selectedChainId changes the
    // child's effect runs BEFORE the parent's reset. Picking here would be
    // discarded by the parent's plain setInstantValues({}).
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: PHONE }] })

    const { onChange } = renderCard({ selectionSettled: false })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('picks on the render after the reset lands', () => {
    // Finding 1, second half. Nothing else in the dep array changes between
    // those two commits — value.value is '' both times and contactOptions is
    // the same cached array — so selectionSettled flipping is what makes the
    // effect run again at all.
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: PHONE }] })

    const { onChange, rerender, card } = renderCard({ selectionSettled: false })
    expect(onChange).not.toHaveBeenCalled()

    rerender(card({ selectionSettled: true }))

    expect(onChange).toHaveBeenCalledWith({ value: PHONE })
  })

  it('stops once the pick is visible in the value', () => {
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: PHONE }] })

    const { onChange, rerender, card } = renderCard()
    onChange.mockClear()

    rerender(card({ value: { ...EMPTY, value: PHONE } }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not re-select after the operator unticks it', () => {
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: PHONE }] })

    const { onChange, rerender, card } = renderCard({ value: { ...EMPTY, value: PHONE } })

    // Untick: the radio sets the value back to ''.
    fireEvent.click(screen.getByRole('radio'))
    onChange.mockClear()

    rerender(card({ value: EMPTY }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not re-select a step the operator cleared before minimizing', () => {
    // Finding 2. On restore the card remounts with the persisted values; a
    // cleared step arrives as '' and would look never-visited without the
    // hasPriorEntry seed.
    usePhones.mockReturnValue({ data: [{ id: 1, contact_value: PHONE }] })

    const { onChange } = renderCard({ hasPriorEntry: true })

    expect(onChange).not.toHaveBeenCalled()
  })

  // ── scope, mirroring the pure-helper tests through the real component ─────
  it('leaves several candidates alone', () => {
    usePhones.mockReturnValue({
      data: [
        { id: 1, contact_value: PHONE },
        { id: 2, contact_value: '0509876543' },
      ],
    })

    const { onChange } = renderCard()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does nothing while the list is still loading', () => {
    usePhones.mockReturnValue({ data: undefined })

    const { onChange } = renderCard()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores email contact steps', () => {
    usePhones.mockReturnValue({ data: undefined })
    useEmails.mockReturnValue({ data: [{ id: 1, contact_value: 'a@b.com' }] })

    const { onChange } = renderCard({
      step: { ...(contactStep as Record<string, unknown>), contact_medium: 'email' } as never,
    })

    expect(onChange).not.toHaveBeenCalled()
  })
})
