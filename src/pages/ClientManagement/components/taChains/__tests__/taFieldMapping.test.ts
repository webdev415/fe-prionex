import { describe, it, expect } from 'vitest'

import {
  creditIdsFromCreditSteps,
  extractPhones,
  isPhoneShaped,
  resolveStepValue,
  visibleCredits,
  type StepLike,
} from '../taFieldMapping'

describe('isPhoneShaped', () => {
  it('accepts plain and formatted phone numbers', () => {
    expect(isPhoneShaped('380994239156')).toBe(true)
    expect(isPhoneShaped('+380 (99) 423-91-56')).toBe(true)
    expect(isPhoneShaped('0501234567')).toBe(true)
  })

  it('rejects datetime values (Bug 1)', () => {
    // 14 digits — would have passed the old digit-only check.
    expect(isPhoneShaped('2026-05-15T10:30:00')).toBe(false)
    expect(isPhoneShaped('19/06/2026 21:45')).toBe(false)
    expect(isPhoneShaped('2026-05-15 10:30')).toBe(false)
  })

  it('rejects debt-id lists, labels and too-short numbers', () => {
    expect(isPhoneShaped('604948,609498')).toBe(false) // comma list
    expect(isPhoneShaped('Promise to pay')).toBe(false) // dropdown label
    expect(isPhoneShaped('2026-05-15')).toBe(false) // date only (8 digits)
    expect(isPhoneShaped('88921')).toBe(false) // debt id (5 digits)
  })
})

describe('extractPhones', () => {
  const steps: StepLike[] = [
    { step_order: 1, target_action_id: 10, target_action_field_type: 'contact' },
    { step_order: 2, target_action_id: 20, target_action_field_type: 'date' },
  ]

  it('returns the phone and never the date (Bug 1 scenario)', () => {
    const stepData = {
      '1': '380994239156', // contact step → phone
      '2': '2026-05-15T10:30:00', // date step → must NOT appear
    }
    expect(extractPhones(stepData, steps)).toEqual(['380994239156'])
  })

  it('returns [] when there is no phone-shaped value', () => {
    expect(extractPhones({ '2': '2026-05-15T10:30:00' }, steps)).toEqual([])
    expect(extractPhones(null, steps)).toEqual([])
  })
})

describe('resolveStepValue', () => {
  const contactStep: StepLike = { step_order: 1, target_action_id: 42 }
  const loanStep: StepLike = { step_order: 2, target_action_id: 99 }

  it('prefers the wizard snapshot keyed by step_order', () => {
    const v = resolveStepValue(
      contactStep,
      [contactStep, loanStep],
      { '1': { value: '380994239156' } },
      { '42': 'legacy-should-be-ignored' }
    )
    expect(v).toBe('380994239156')
  })

  it('uses the target_action_id fallback only when the TA is unique', () => {
    const v = resolveStepValue(loanStep, [contactStep, loanStep], undefined, {
      '99': '357807',
    })
    expect(v).toBe('357807')
  })

  it('keeps an empty loan step empty when steps share a TA (Bug 2)', () => {
    // Contact + loan steps share target_action_id 42; interaction data is
    // keyed by TA id and holds the phone. The loan step must NOT inherit it.
    const sharedContact: StepLike = { step_order: 1, target_action_id: 42 }
    const sharedLoan: StepLike = { step_order: 2, target_action_id: 42 }
    const v = resolveStepValue(
      sharedLoan,
      [sharedContact, sharedLoan],
      undefined,
      { '42': '380994239156' } // phone keyed by the shared TA id
    )
    expect(v).toBe('') // empty — no phone leak into the loan field
  })

  it('returns empty string when nothing matches', () => {
    expect(resolveStepValue(loanStep, [contactStep, loanStep], {}, {})).toBe('')
  })
})

describe('visibleCredits (Bug 4)', () => {
  const debts = [
    { id: 1, status: 'active' },
    { id: 2, status: 'closed' },
    { id: 3, status: 'overdue' },
  ]

  it('hides closed debts when show_closed_credits is off', () => {
    expect(visibleCredits(debts, false).map((d) => d.id)).toEqual([1, 3])
  })

  it('shows all debts when show_closed_credits is on', () => {
    expect(visibleCredits(debts, true).map((d) => d.id)).toEqual([1, 2, 3])
  })

  it('keeps an already-selected closed debt so editing never drops it', () => {
    // Closed debt #2 is already selected on the interaction → keep it visible
    // even though the flag is off, so the saved value isn't silently removed.
    expect(visibleCredits(debts, false, ['2']).map((d) => d.id)).toEqual([1, 2, 3])
  })

  it('treats missing/blank status as not closed', () => {
    const d = [{ id: 9 }, { id: 10, status: null }]
    expect(visibleCredits(d, false).map((x) => x.id)).toEqual([9, 10])
  })
})

describe('creditIdsFromCreditSteps (KAN-744)', () => {
  // Chain "Стягнення: Контакт з клієнтом": Step 2 = dropdown result,
  // Step 3 = dropdown subtype, Step 7 = the only credit step.
  const steps = [
    { step_order: 2, field_type: 'dropdown' },
    { step_order: 3, field_type: 'dropdown' },
    { step_order: 7, field_type: 'credit' },
  ]

  it('reproduces the reported bug and shows only the credit step(s)', () => {
    // Resolved (snapshot-first) values: Step 7 holds the two real picks; a
    // phantom debt id has drifted into Step 3 (a dropdown). The old display
    // surfaced #162040 from Step 3 AND missed #257867 — making one credit
    // step look like several.
    const resolved = {
      '2': 'Домовленість',
      '3': '162040', // phantom in a dropdown step — must be ignored
      '7': '162040,257867', // the actual credit step, both picks
    }
    expect(creditIdsFromCreditSteps(steps, resolved)).toEqual(['162040', '257867'])
  })

  it('returns one credit when one is picked', () => {
    expect(creditIdsFromCreditSteps(steps, { '7': '43820' })).toEqual(['43820'])
  })

  it('de-duplicates the same credit picked across multiple credit steps', () => {
    const two = [
      { step_order: 2, field_type: 'credit' },
      { step_order: 3, field_type: 'credit' },
    ]
    expect(creditIdsFromCreditSteps(two, { '2': '88921', '3': '88921' })).toEqual(['88921'])
  })

  it('ignores credit-shaped values sitting in non-credit steps', () => {
    expect(
      creditIdsFromCreditSteps([{ step_order: 1, field_type: 'dropdown' }], { '1': '162040' })
    ).toEqual([])
  })
})
