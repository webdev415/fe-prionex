/**
 * The editor's own responsibility, as distinct from any one row: keeping the
 * parameter set coherent when one row invalidates another.
 *
 * Chain steps are the case that matters. A step belongs to a chain, so dropping
 * a chain has to drop its steps — left behind, the step stays in the saved
 * preset and silently narrows every result the preset is ever applied to, with
 * nothing on screen to explain why.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { ClientFilterPresetParams } from '../types'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { active_project_id: '1' }, isLoading: false }),
}))

const step = (id: number, chainId: number, name: string) => ({
  id,
  chain_id: chainId,
  target_action_id: id,
  target_action_name: name,
  target_action_field_type: null,
  step_order: 1,
  is_required: false,
  delay_minutes: 0,
  not_in_the_past: false,
  contact_source: null,
  contact_medium: 'phone' as const,
  show_closed_credits: false,
  position_x: null,
  position_y: null,
})

const chain = (id: number, name: string, steps: ReturnType<typeof step>[]) => ({
  id,
  name,
  description: null,
  chain_type: 'manual' as const,
  department_ids: [],
  is_active: true,
  is_system_hidden: false,
  is_pinned: false,
  steps,
  step_count: steps.length,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

const CHAINS = [
  chain(10, 'Soft collection', [step(101, 10, 'Call')]),
  chain(20, 'Legal', [step(201, 20, 'Notice')]),
]

vi.mock('../hooks/usePresetFilterOptions', () => ({
  usePresetFilterOptions: () => ({
    portfolios: [],
    tags: [],
    rrStatuses: [],
    chains: CHAINS,
    employees: [],
    interactionUsers: [],
    searchers: [],
  }),
}))

const { ClientFilterPresetEditor } = await import('../components/ClientFilterPresetEditor')

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

function Harness({
  initial = {},
  onParamsChange,
}: {
  initial?: ClientFilterPresetParams
  onParamsChange?: (next: ClientFilterPresetParams) => void
}) {
  const [params, setParams] = useState<ClientFilterPresetParams>(initial)
  return (
    <ClientFilterPresetEditor
      editingId={null}
      name="Preset"
      params={params}
      nameError={false}
      saved={false}
      onNameChange={vi.fn()}
      onParamsChange={(next) => {
        setParams(next)
        onParamsChange?.(next)
      }}
      onSave={vi.fn()}
      onClearFields={vi.fn()}
      now={new Date(2026, 8, 11)}
    />
  )
}

/**
 * Picks an item inside one of the editor's checkbox dropdowns. Scoped to the
 * open menu because the trigger repeats the selected labels as its summary, so
 * an unscoped query matches the same text twice once something is chosen.
 */
async function pick(user: ReturnType<typeof userEvent.setup>, testId: string, label: string) {
  if (screen.queryByRole('menu')) await user.keyboard('{Escape}')
  await user.click(screen.getByTestId(testId))
  const menu = screen.getByRole('menu')
  await user.click(within(menu).getByText(label))
}

describe('ClientFilterPresetEditor', () => {
  it('offers no steps until a chain is chosen', () => {
    render(<Harness />)

    expect(screen.getByText('pages.profile.presets.fields.chainStepHint')).toBeTruthy()
    expect(screen.getByTestId('preset-chain-step')).toBeDisabled()
  })

  it("offers the chosen chain's steps once it is picked", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await pick(user, 'preset-chain', 'Soft collection')

    expect(screen.queryByText('pages.profile.presets.fields.chainStepHint')).toBeNull()
    await user.click(screen.getByTestId('preset-chain-step'))
    expect(screen.getByText('Call')).toBeTruthy()
  })

  it('drops a step when the chain it belongs to is deselected', async () => {
    const user = userEvent.setup()
    const onParamsChange = vi.fn()
    render(<Harness onParamsChange={onParamsChange} />)

    await pick(user, 'preset-chain', 'Soft collection')
    await pick(user, 'preset-chain-step', 'Call')
    expect(onParamsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ chainIds: [10], chainStepIds: [101] })
    )

    // Unpicking the chain strands the step, so it goes with it.
    await pick(user, 'preset-chain', 'Soft collection')
    const last = onParamsChange.mock.lastCall?.[0] as ClientFilterPresetParams
    expect(last.chainIds).toBeUndefined()
    expect(last.chainStepIds).toBeUndefined()
  })

  it('keeps the steps of the chains that remain selected', async () => {
    const user = userEvent.setup()
    const onParamsChange = vi.fn()
    render(<Harness onParamsChange={onParamsChange} />)

    await pick(user, 'preset-chain', 'Soft collection')
    await pick(user, 'preset-chain', 'Legal')
    await pick(user, 'preset-chain-step', 'Soft collection — Call')
    await pick(user, 'preset-chain-step', 'Legal — Notice')

    await pick(user, 'preset-chain', 'Legal')

    const last = onParamsChange.mock.lastCall?.[0] as ClientFilterPresetParams
    expect(last.chainIds).toEqual([10])
    // 201 belonged to Legal and is gone; 101 is still in a selected chain.
    expect(last.chainStepIds).toEqual([101])
  })

  it('defaults "only last chain" to on, matching the client list', () => {
    render(<Harness />)

    expect(
      screen.getByRole('checkbox', { name: 'pages.profile.presets.fields.onlyLastChain' })
    ).toBeChecked()
  })
})
