import { describe, expect, it } from 'vitest'
import type { ChainInstanceStepSnapshot } from '@/features/taInteractions/api/types'
import { applyStepEdits, collectFromSnapshot } from '../taChainSaveData'

/**
 * These tests reproduce the minimize/restore bug at the data layer.
 *
 * Scenario: an operator fills steps 1-3 (each advanced to the backend, so they
 * live in chain_instances.step_data), minimizes, restores — which unmounts the
 * form and WIPES the in-memory refs — then finishes the last step and saves.
 *
 * handleSave builds the saved interaction's step_data as
 *   { ...collectFromSnapshot(activeInstance.step_data).stepData, ...inMemory }
 * so the fix is correct iff the merge still contains the pre-minimize steps
 * even when the in-memory map only has the current step.
 */

const snap = (v: Partial<ChainInstanceStepSnapshot>): ChainInstanceStepSnapshot => v

describe('collectFromSnapshot', () => {
  it('extracts step values keyed by step_order', () => {
    const result = collectFromSnapshot({
      '1': snap({ value: 'Alice', target_action_id: 10 }),
      '2': snap({ value: '500', target_action_id: 11 }),
    })
    expect(result.stepData).toEqual({ '1': 'Alice', '2': '500' })
  })

  it('skips empty/missing values', () => {
    const result = collectFromSnapshot({
      '1': snap({ value: 'Alice' }),
      '2': snap({ value: '' }),
      '3': snap({ value: null }),
      '4': snap({ dropdown_value_id: 7 }), // no value
    })
    expect(result.stepData).toEqual({ '1': 'Alice' })
  })

  it('extracts dropdown ids, promise date/amount and credit (first non-empty)', () => {
    const result = collectFromSnapshot({
      '1': snap({ value: 'x', dropdown_value_id: 42, promise_date: '2026-06-10T09:00:00' }),
      '2': snap({ value: 'y', promise_amount: '500', credit_id: '77' }),
    })
    expect(result.dropdownIds).toEqual({ '1': 42 })
    expect(result.promiseDate).toBe('2026-06-10T09:00:00')
    expect(result.promiseAmount).toBe('500')
    expect(result.creditId).toBe('77')
  })

  it('returns empty structures for null/empty snapshot', () => {
    expect(collectFromSnapshot(null)).toEqual({
      stepData: {},
      dropdownIds: {},
      promiseDate: '',
      promiseAmount: '',
      creditId: '',
    })
    expect(collectFromSnapshot(undefined).stepData).toEqual({})
  })
})

describe('minimize/restore save merge (the bug scenario)', () => {
  // Server snapshot after advancing steps 1-3 before minimizing.
  const serverSnapshot: Record<string, ChainInstanceStepSnapshot> = {
    '1': snap({ value: 'Alice', target_action_id: 10 }),
    '2': snap({ value: '2026-06-10T09:00', target_action_id: 11 }),
    '3': snap({ value: 'Promised to pay', target_action_id: 12, dropdown_value_id: 99 }),
  }

  it('keeps pre-minimize steps when in-memory state was wiped by restore', () => {
    // After minimize/restore the in-memory ref was reset; only the current
    // (last) step the user just filled remains.
    const inMemoryAfterRestore = { '4': 'Final note value' }

    const merged = {
      ...collectFromSnapshot(serverSnapshot).stepData,
      ...inMemoryAfterRestore,
    }

    // All four steps must be present — steps 1-3 recovered from the snapshot.
    expect(merged).toEqual({
      '1': 'Alice',
      '2': '2026-06-10T09:00',
      '3': 'Promised to pay',
      '4': 'Final note value',
    })
  })

  it('still works after MULTIPLE minimize/restore cycles (in-memory fully empty)', () => {
    const inMemoryEmpty: Record<string, string> = {}
    const merged = { ...collectFromSnapshot(serverSnapshot).stepData, ...inMemoryEmpty }
    expect(Object.keys(merged)).toEqual(['1', '2', '3'])
  })

  it('lets in-memory edits win over the snapshot on conflict', () => {
    // Operator edited step 1 locally after restore (not yet re-advanced).
    const inMemoryWithEdit: Record<string, string> = { '1': 'Alice EDITED', '4': 'note' }
    const merged = { ...collectFromSnapshot(serverSnapshot).stepData, ...inMemoryWithEdit }
    expect(merged['1']).toBe('Alice EDITED')
    expect(merged['2']).toBe('2026-06-10T09:00') // untouched snapshot step preserved
  })

  it('non-minimize flow is unchanged: in-memory superset reproduces the same result', () => {
    // Normal run: in-memory has every step already; snapshot adds nothing new.
    const inMemoryComplete = {
      '1': 'Alice',
      '2': '2026-06-10T09:00',
      '3': 'Promised to pay',
      '4': 'note',
    }
    const merged = { ...collectFromSnapshot(serverSnapshot).stepData, ...inMemoryComplete }
    expect(merged).toEqual(inMemoryComplete)
  })
})

describe('applyStepEdits (edit a previously confirmed step)', () => {
  // Step 1 was confirmed with promise 500 / 10-07; the server snapshot holds it.
  const confirmed: Record<string, ChainInstanceStepSnapshot> = {
    '1': snap({ value: 'Promise to pay', promise_amount: '500', promise_date: '2026-07-10' }),
  }

  it('reflects an edited promise amount/date instead of the original', () => {
    const edited = applyStepEdits(confirmed, {
      '1': { promiseAmount: '100', promiseDate: '2026-07-11' },
    })
    const collected = collectFromSnapshot(edited)
    expect(collected.promiseAmount).toBe('100')
    expect(collected.promiseDate).toBe('2026-07-11')
  })

  it('with no edits, keeps the originally confirmed values', () => {
    const collected = collectFromSnapshot(applyStepEdits(confirmed, {}))
    expect(collected.promiseAmount).toBe('500')
    expect(collected.promiseDate).toBe('2026-07-10')
  })

  it("editing one step never clobbers another step's promise", () => {
    const twoSteps: Record<string, ChainInstanceStepSnapshot> = {
      '1': snap({ value: 'a', promise_amount: '500', promise_date: '2026-07-10' }),
      '2': snap({ value: 'b' }),
    }
    const edited = applyStepEdits(twoSteps, { '2': { value: 'b-edited' } })
    const collected = collectFromSnapshot(edited)
    expect(collected.promiseAmount).toBe('500')
    expect(collected.promiseDate).toBe('2026-07-10')
    expect(collected.stepData['2']).toBe('b-edited')
  })

  it('does not mutate the input snapshot', () => {
    const before = JSON.stringify(confirmed)
    applyStepEdits(confirmed, { '1': { promiseAmount: '999' } })
    expect(JSON.stringify(confirmed)).toBe(before)
  })

  it('an explicitly cleared field is honored', () => {
    const edited = applyStepEdits(confirmed, { '1': { promiseAmount: '' } })
    expect(edited['1'].promise_amount).toBe('')
  })
})
