import { describe, it, expect } from 'vitest'

import type { TAChainStep } from '@/features/taChains/api/types'
import { taChainStepsToInput } from '../taChainFormHelpers'

function makeStep(overrides: Partial<TAChainStep> = {}): TAChainStep {
  return {
    id: 1,
    chain_id: 7,
    target_action_id: 10, // a credit-type TA
    target_action_name: 'Credit',
    target_action_field_type: 'credit',
    step_order: 1,
    is_required: true,
    delay_minutes: 0,
    not_in_the_past: false,
    contact_source: null,
    contact_medium: 'phone',
    show_closed_credits: true,
    is_promise_date: false,
    is_promise_amount: false,
    position_x: null,
    position_y: null,
    ...overrides,
  }
}

describe('taChainStepsToInput', () => {
  // The fe-14 regression: a credit step saved with the flag ON must keep it
  // ON after the form maps it for editing. Before the fix the field was
  // dropped here, so any subsequent save reset it to false.
  it('preserves show_closed_credits=true (the silent-data-loss scenario)', () => {
    const result = taChainStepsToInput([makeStep({ show_closed_credits: true })])
    expect(result[0].show_closed_credits).toBe(true)
  })

  it('keeps show_closed_credits=false as false', () => {
    const result = taChainStepsToInput([makeStep({ show_closed_credits: false })])
    expect(result[0].show_closed_credits).toBe(false)
  })

  it('defaults a missing show_closed_credits to false', () => {
    const step = makeStep()
    delete (step as Partial<TAChainStep>).show_closed_credits
    const result = taChainStepsToInput([step])
    expect(result[0].show_closed_credits).toBe(false)
  })

  it('round-trips every editable field', () => {
    const result = taChainStepsToInput([
      makeStep({
        target_action_id: 23,
        is_required: false,
        delay_minutes: 15,
        not_in_the_past: true,
        contact_source: 'client',
        show_closed_credits: true,
        // No field type, so the mapper has nothing to check the flags against
        // and keeps them: the point here is that every field survives the
        // copy, not what a given step type is allowed to carry.
        target_action_field_type: null,
        is_promise_date: true,
        is_promise_amount: true,
      }),
    ])
    expect(result[0]).toEqual({
      target_action_id: 23,
      is_required: false,
      delay_minutes: 15,
      not_in_the_past: true,
      contact_source: 'client',
      show_closed_credits: true,
      is_promise_date: true,
      is_promise_amount: true,
    })
  })

  it('maps each step independently', () => {
    const result = taChainStepsToInput([
      makeStep({ id: 1, show_closed_credits: true }),
      makeStep({ id: 2, show_closed_credits: false }),
    ])
    expect(result.map((s) => s.show_closed_credits)).toEqual([true, false])
  })

  it('returns an empty array when there are no steps', () => {
    expect(taChainStepsToInput(undefined)).toEqual([])
    expect(taChainStepsToInput([])).toEqual([])
  })

  // KAN-1069, and the second time this exact bug has been written. The mapper
  // copies field by field, so any step setting not listed here reads back as
  // its default: the chain saves correctly, reopens with the boxes unticked,
  // and the admin reports "it did not save".
  it('preserves the promise flags (KAN-1069)', () => {
    const [out] = taChainStepsToInput([
      makeStep({
        target_action_field_type: 'date',
        is_promise_date: true,
        is_promise_amount: false,
      }),
    ])
    expect(out.is_promise_date).toBe(true)
    expect(out.is_promise_amount).toBe(false)
  })

  it('preserves is_promise_amount independently', () => {
    const [out] = taChainStepsToInput([
      makeStep({ target_action_field_type: 'amount', is_promise_amount: true }),
    ])
    expect(out.is_promise_amount).toBe(true)
  })

  // KAN-1069 review. A flag can outlive the type that justified it: chains
  // saved before the editor learned to clear flags on retype still carry one.
  // It is invisible (the checkbox renders only for date / amount) and the
  // server refuses the chain, so the admin sees a save that fails with no
  // cause and no control to untick. Opening the chain repairs it.
  it('drops a flag the step type cannot carry', () => {
    const [out] = taChainStepsToInput([
      makeStep({
        target_action_field_type: 'text',
        is_promise_date: true,
        is_promise_amount: true,
      }),
    ])
    expect(out.is_promise_date).toBe(false)
    expect(out.is_promise_amount).toBe(false)
  })

  it('drops the flag of the other half on a date step', () => {
    const [out] = taChainStepsToInput([
      makeStep({
        target_action_field_type: 'date',
        is_promise_date: true,
        is_promise_amount: true,
      }),
    ])
    expect(out.is_promise_date).toBe(true)
    expect(out.is_promise_amount).toBe(false)
  })

  it('keeps a flag when the field type is unknown', () => {
    // Nullable in the API type. Dropping on absence would turn a thin response
    // into silent data loss.
    const [out] = taChainStepsToInput([
      makeStep({ target_action_field_type: null, is_promise_date: true }),
    ])
    expect(out.is_promise_date).toBe(true)
  })
})
