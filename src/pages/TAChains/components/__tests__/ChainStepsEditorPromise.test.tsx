/**
 * KAN-1069 — the promise checkboxes in the chain builder.
 *
 * Drives the real `ChainStepsEditor` rather than the helpers: what matters is
 * which checkbox an admin can see on which kind of step, and what happens when
 * they tick a second one. Both are rendering decisions, and neither is visible
 * from a unit test of the data.
 *
 * The pairing rule ("both flags or neither") is NOT tested here, because it is
 * not enforced here — ticking the first of a pair is always a step through an
 * invalid state on the way to a valid one, so the server owns that rule and
 * the form surfaces its message. The backend has it covered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChainStepsEditor } from '../ChainStepsEditor'
import type { TAChainStepIn } from '@/features/taChains/api/types'

const TAS = [
  { id: 1, name: 'Result', field_type: 'text', is_hidden: false, dropdown_values: [] },
  { id: 2, name: 'Sum', field_type: 'amount', is_hidden: false, dropdown_values: [] },
  { id: 3, name: 'When', field_type: 'date', is_hidden: false, dropdown_values: [] },
  { id: 4, name: 'Sum 2', field_type: 'amount', is_hidden: false, dropdown_values: [] },
]

vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: TAS } }),
}))
vi.mock('@/features/clients/hooks/useClients', () => ({
  useContactTypes: () => ({ data: [] }),
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }))

// The shared i18n mock returns the key for anything it has no entry for.
const PROMISE_DATE = 'pages.taChains.steps.countAsPromiseDate'
const PROMISE_AMOUNT = 'pages.taChains.steps.countAsPromiseAmount'

const onChange = vi.fn()

function setup(steps: TAChainStepIn[], { disabled = false } = {}) {
  onChange.mockClear()
  toastError.mockClear()
  return render(<ChainStepsEditor steps={steps} onChange={onChange} disabled={disabled} />)
}

const step = (target_action_id: number, extra: Partial<TAChainStepIn> = {}) =>
  ({ target_action_id, is_required: true, delay_minutes: 0, ...extra }) as TAChainStepIn

/** The steps the editor emitted on the last change. */
function lastSteps(): TAChainStepIn[] {
  return onChange.mock.calls.at(-1)?.[0] as TAChainStepIn[]
}

describe('promise checkboxes (KAN-1069)', () => {
  beforeEach(() => onChange.mockClear())

  it('offers the date checkbox only on a Date step', () => {
    setup([step(3)])
    expect(screen.getByRole('checkbox', { name: PROMISE_DATE })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: PROMISE_AMOUNT })).not.toBeInTheDocument()
  })

  it('offers the amount checkbox only on an Amount step', () => {
    setup([step(2)])
    expect(screen.getByRole('checkbox', { name: PROMISE_AMOUNT })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: PROMISE_DATE })).not.toBeInTheDocument()
  })

  it('offers neither on a step that can hold neither', () => {
    setup([step(1)])
    expect(screen.queryByRole('checkbox', { name: PROMISE_DATE })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: PROMISE_AMOUNT })).not.toBeInTheDocument()
  })

  it('ticking one sets the flag on that step alone', () => {
    setup([step(2), step(3)])
    fireEvent.click(screen.getByRole('checkbox', { name: PROMISE_AMOUNT }))

    const steps = lastSteps()
    expect(steps[0].is_promise_amount).toBe(true)
    expect(steps[1].is_promise_amount).toBeFalsy()
  })

  it('refuses a second flag of the same type and keeps the first', () => {
    // Two Amount steps, the first already flagged.
    setup([step(2, { is_promise_amount: true }), step(4)])

    const boxes = screen.getAllByRole('checkbox', { name: PROMISE_AMOUNT })
    fireEvent.click(boxes[1])

    // Nothing was emitted — the earlier choice is not silently undone, which
    // is what the ticket asks for.
    expect(onChange).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('unticking is never blocked', () => {
    setup([step(2, { is_promise_amount: true }), step(4)])
    const boxes = screen.getAllByRole('checkbox', { name: PROMISE_AMOUNT })

    fireEvent.click(boxes[0])

    expect(toastError).not.toHaveBeenCalled()
    expect(lastSteps()[0].is_promise_amount).toBe(false)
  })

  it('a date flag does not collide with an amount flag', () => {
    // Different types are independent — flagging one must not block the other.
    setup([step(2, { is_promise_amount: true }), step(3)])
    fireEvent.click(screen.getByRole('checkbox', { name: PROMISE_DATE }))

    expect(toastError).not.toHaveBeenCalled()
    expect(lastSteps()[1].is_promise_date).toBe(true)
  })

  it('follows the chain lock like every other step setting', () => {
    // A chain locks once it has its first saved interaction; TAChainForm
    // passes that through as `disabled`. The ticket asks for the new
    // checkboxes to obey the same rule rather than becoming a hole in it.
    setup([step(2), step(3)], { disabled: true })

    expect(screen.getByRole('checkbox', { name: PROMISE_AMOUNT })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: PROMISE_DATE })).toBeDisabled()
  })
})
