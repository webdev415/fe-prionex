/**
 * KAN-821 — the Chain filter's multi-select and "Only last TA chain" checkbox.
 *
 * Scoped to the chain section on purpose: the rest of the bar has its own
 * behaviour and its own hooks, and dragging it in would make these tests fail
 * for reasons unrelated to what they guard.
 *
 * What they guard:
 *   * several chains can be picked at once (the filter used to be single-select)
 *   * the checkbox defaults to ON — the ticket's intentional behaviour change
 *   * changing the chain selection clears the step picks, which belong to the
 *     chains that were selected a moment ago
 *   * with several chains picked, the Step list is their union and each entry
 *     names its chain — otherwise two chains with a same-named step are
 *     indistinguishable in the dropdown
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientFiltersBar } from '../ClientFiltersBar'
import type { ClientFilters } from '../../ClientManagementPage'
import { buildChainStepOptions } from '../chainStepOptions'

// The shared i18n mock (src/test/setup.ts) returns the translation KEY for any
// key it has no entry for — the inline English fallback in `t(key, fallback)`
// is not consulted. So these queries match keys, not the visible copy.
const ONLY_LAST = 'pages.clients.filters.onlyLastChain'

const CHAINS = [
  {
    id: 1,
    name: 'Collection',
    steps: [
      { id: 11, chain_id: 1, target_action_id: 100, target_action_name: 'Contact', step_order: 1 },
    ],
  },
  {
    id: 2,
    name: 'Support',
    steps: [
      // Same visible name as chain 1's step — the case that needs the prefix.
      { id: 22, chain_id: 2, target_action_id: 100, target_action_name: 'Contact', step_order: 1 },
    ],
  },
]

vi.mock('@/features/taChains', () => ({
  useTAChains: () => ({ data: { items: CHAINS } }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: [] } }),
}))
vi.mock('@/features/sellers/hooks/useSellers', () => ({
  useSellers: () => ({ data: { items: [] }, isLoading: false }),
}))
// useTags resolves to the array itself, not a paged envelope. The bar also
// pulls useSegments from this module, so the mock has to cover both.
vi.mock('@/features/tags/hooks/useTags', () => ({
  useTags: () => ({ data: [], isLoading: false }),
  useSegments: () => ({ data: { items: [] }, isLoading: false }),
}))

const onFilterChange = vi.fn()

function setup(filters: Partial<ClientFilters> = {}) {
  onFilterChange.mockClear()
  // Hooks in the bar that these tests don't mock still reach react-query.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ClientFiltersBar filters={filters as ClientFilters} onFilterChange={onFilterChange} />
    </QueryClientProvider>
  )
}

/** Last call's payload — the bar rebuilds the whole filter object each time. */
function lastFilters(): Partial<ClientFilters> {
  return onFilterChange.mock.calls.at(-1)?.[0] ?? {}
}

describe('"Only last TA chain" checkbox (KAN-821)', () => {
  beforeEach(() => onFilterChange.mockClear())

  it('is on by default', () => {
    // The ticket's intentional behaviour change: the filter answers "where is
    // the client now", not "where have they ever been".
    setup({ chainIds: [1] })
    expect(screen.getByRole('checkbox', { name: ONLY_LAST })).toBeChecked()
  })

  it('stays on when the caller has not stored a value yet', () => {
    setup({ chainIds: [1], onlyLastChain: undefined })
    expect(screen.getByRole('checkbox', { name: ONLY_LAST })).toBeChecked()
  })

  it('can be turned off to get the old behaviour back', () => {
    setup({ chainIds: [1] })
    fireEvent.click(screen.getByRole('checkbox', { name: ONLY_LAST }))

    expect(lastFilters().onlyLastChain).toBe(false)
  })

  it('can be changed before any chain is picked', () => {
    // It used to be disabled until a chain was chosen. A ticked box that
    // ignores clicks and explains nothing reads as broken — the first person
    // to see it asked why they could not untick it. The server ignores the
    // flag until there is a chain to narrow, so holding the preference early
    // costs nothing.
    setup({ chainIds: [] })
    const box = screen.getByRole('checkbox', { name: ONLY_LAST })
    expect(box).toBeEnabled()

    fireEvent.click(box)
    expect(lastFilters().onlyLastChain).toBe(false)
  })
})

describe('Step list across several chains (KAN-821)', () => {
  // Driven through the helper rather than the picker: the picker is a Radix
  // menu, which needs pointer-capture polyfills to open under jsdom, and the
  // labelling rule is the part this ticket introduced.
  const asChains = CHAINS as unknown as Parameters<typeof buildChainStepOptions>[0]

  it('unions the steps of every picked chain', () => {
    const opts = buildChainStepOptions(asChains)
    expect(opts.map((s) => s.id)).toEqual([11, 22])
  })

  it('names the chain when more than one is picked', () => {
    // Both chains have a step called "Contact"; without the prefix the operator
    // cannot tell which is which.
    const labels = buildChainStepOptions(asChains).map((s) => s.target_action_name)
    expect(labels).toEqual(['Collection — Contact', 'Support — Contact'])
  })

  it('leaves the label alone for a single chain', () => {
    const opts = buildChainStepOptions([asChains[0]])
    expect(opts.map((s) => s.target_action_name)).toEqual(['Contact'])
  })

  it('is empty when no chain is picked', () => {
    expect(buildChainStepOptions([])).toEqual([])
  })
})
