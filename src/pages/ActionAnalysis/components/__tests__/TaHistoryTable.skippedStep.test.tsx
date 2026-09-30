/**
 * The Result column must not invent a value for a step that was skipped.
 *
 * `readStepValue` is unit-tested on its own, but the reader is only half of
 * what the operator sees. The other half is the formatter: a borrowed *text*
 * value landing on a date step is not shown as obviously wrong text — it is
 * parsed and rendered as a plausible date. QA's report was a step showing
 * "01-01-222 02:02", which is the string "222" put through the date formatter.
 * A reader-level test cannot catch that, so the whole path is pinned here.
 *
 * The fixture is the chain that produced the report: a branching chain whose
 * middle step is skipped, and whose skipped step has a target action id equal
 * to the step order of the step after it.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { TaHistoryTable } from '../TaHistoryTable'
import type { TAInteraction } from '@/features/taInteractions/api/types'
import type { TAChain, TAChainStep } from '@/features/taChains/api/types'
import type { TargetAction } from '@/features/targetActions/api/types'

function makeStep(step_order: number, target_action_id: number, fieldType: string): TAChainStep {
  return {
    id: step_order,
    chain_id: 3,
    target_action_id,
    target_action_name: `step ${step_order}`,
    target_action_field_type: fieldType,
    step_order,
    is_required: false,
    delay_minutes: 0,
    not_in_the_past: false,
    contact_source: null,
    contact_medium: 'phone',
    show_closed_credits: false,
    is_promise_date: false,
    is_promise_amount: false,
    position_x: null,
    position_y: null,
  }
}

// Step 2's target action id is 3 — which is also step 3's *order*. That
// collision is the whole defect: the two live in one flat key namespace.
const CHAIN: TAChain = {
  id: 3,
  name: 'branching chain',
  description: null,
  chain_type: 'manual',
  department_ids: [],
  is_active: true,
  is_system_hidden: false,
  is_pinned: false,
  steps: [makeStep(1, 2, 'dropdown'), makeStep(2, 3, 'date'), makeStep(3, 4, 'text')],
  step_count: 3,
  created_by: null,
  created_at: '2026-09-30T06:00:00Z',
  updated_at: '2026-09-30T06:00:00Z',
}

function makeInteraction(id: number, step_data: Record<string, unknown>): TAInteraction {
  return {
    id,
    client_id: 226,
    credit_id: null,
    chain_id: 3,
    chain_name: 'branching chain',
    chain_instance_id: null,
    leaf_node_id: null,
    leaf_node_name: null,
    dropdown_value_id: null,
    dropdown_value_name: null,
    dictionary_path: [],
    promise_date: null,
    promise_amount: null,
    notes: null,
    step_data,
    recorded_by: null,
    recorded_by_name: null,
    recorded_by_full_name: null,
    call_id: null,
    assigned_operator_id: null,
    assigned_operator_name: null,
    current_responsible_id: null,
    current_responsible_name: null,
    created_at: '2026-09-30T06:35:00Z',
    archived: false,
    is_pinned: false,
    pinned_at: null,
    self_edit_expires_at: null,
  }
}

function resultCellText(interaction: TAInteraction): string {
  const { container } = render(
    <MemoryRouter>
      <TaHistoryTable
        data={[interaction]}
        chains={[CHAIN]}
        tasById={new Map<number, TargetAction>()}
        userTimezone="UTC"
      />
    </MemoryRouter>
  )
  const cell = Array.from(container.querySelectorAll('td')).find((td) =>
    /^[ABC]/.test(td.textContent ?? '')
  )
  return cell?.textContent ?? ''
}

describe('TaHistoryTable — a skipped step in a branching chain', () => {
  it("shows only what was recorded, not the next step's value as a date", () => {
    // The branch that skips the date step: keys are 1 and 3, nothing at 2.
    expect(resultCellText(makeInteraction(1780, { '1': 'B', '3': '222' }))).toBe('B -> 222')
  })

  it('still shows the date step when the branch did run through it', () => {
    const text = resultCellText(
      makeInteraction(1781, { '1': 'C', '2': '2026-09-30T07:00:00.000Z', '3': '333' })
    )
    expect(text).toBe('C -> 30-09-2026 07:00 -> 333')
  })
})
