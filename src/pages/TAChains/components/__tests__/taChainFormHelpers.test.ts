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
      }),
    ])
    expect(result[0]).toEqual({
      target_action_id: 23,
      is_required: false,
      delay_minutes: 15,
      not_in_the_past: true,
      contact_source: 'client',
      show_closed_credits: true,
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
})
