/**
 * The "Has verified payment(s)" checkbox.
 *
 * Scoped to this one control, the way the chain suite is scoped to its own:
 * the rest of the bar has its own hooks and its own behaviour, and pulling it
 * in would make these fail for unrelated reasons.
 *
 * What they guard:
 *   * the box is UNCHECKED by default, and an absent value reads as unchecked
 *     rather than as "undefined" — the ticket's default state, and the state
 *     after a reset;
 *   * ticking it sets the flag, unticking clears it;
 *   * it sits between the Tags block and the RR status block, which is the
 *     one placement instruction the ticket gives.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientFiltersBar } from '../ClientFiltersBar'
import type { ClientFilters } from '../../ClientManagementPage'

// The shared i18n mock (src/test/setup.ts) returns the translation KEY for any
// key it has no entry for — the inline English fallback in `t(key, fallback)`
// is not consulted. So these queries match keys, not the visible copy.
const HAS_VERIFIED = 'pages.clients.filters.hasVerifiedPayment'
const RR_STATUS = 'pages.clients.filters.rrStatus'
// The Tags label resolves through the shared i18n mock to plain 'Tags',
// unlike the two keys above which the mock has no entry for.
const TAGS = 'Tags'

vi.mock('@/features/taChains', () => ({
  useTAChains: () => ({ data: { items: [] } }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: [] } }),
}))
vi.mock('@/features/sellers/hooks/useSellers', () => ({
  useSellers: () => ({ data: { items: [] }, isLoading: false }),
}))
vi.mock('@/features/tags/hooks/useTags', () => ({
  useTags: () => ({ data: [], isLoading: false }),
  useSegments: () => ({ data: { items: [] }, isLoading: false }),
}))

const onFilterChange = vi.fn()

function setup(filters: Partial<ClientFilters> = {}) {
  onFilterChange.mockClear()
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

function checkbox() {
  return screen.getByRole('checkbox', { name: HAS_VERIFIED })
}

describe('"Has verified payment(s)" checkbox', () => {
  beforeEach(() => onFilterChange.mockClear())

  it('is unchecked by default', () => {
    setup({})
    expect(checkbox()).not.toBeChecked()
  })

  it('reads an absent value as unchecked, not as undefined', () => {
    // The reset path clears the flag rather than setting it false, and a
    // saved filter from before this ticket carries no key at all. Both arrive
    // here as `undefined`, and a checkbox fed `undefined` goes uncontrolled —
    // React then warns and the box stops tracking the filter object.
    setup({ hasVerifiedPayment: undefined })
    expect(checkbox()).not.toBeChecked()
  })

  it('is checked when the filter is on', () => {
    setup({ hasVerifiedPayment: true })
    expect(checkbox()).toBeChecked()
  })

  it('sets the flag when ticked', () => {
    setup({})
    fireEvent.click(checkbox())

    expect(lastFilters().hasVerifiedPayment).toBe(true)
  })

  it('clears the flag when unticked', () => {
    setup({ hasVerifiedPayment: true })
    fireEvent.click(checkbox())

    expect(lastFilters().hasVerifiedPayment).toBe(false)
  })

  it('keeps the rest of the filter object intact', () => {
    // The bar hands back a whole ClientFilters, so a spread that dropped a
    // sibling would silently clear another filter the operator had set.
    setup({ hasVerifiedPayment: false, rrStatusIds: [2, 3] })
    fireEvent.click(checkbox())

    expect(lastFilters().rrStatusIds).toEqual([2, 3])
  })

  it('sits between the Tags block and the RR status block', () => {
    // The ticket's one placement instruction. Compared by document order so
    // the assertion survives any amount of markup between the three.
    setup({})
    const tags = screen.getByText(TAGS)
    const box = checkbox()
    const rr = screen.getByText(RR_STATUS)

    const after = Node.DOCUMENT_POSITION_FOLLOWING
    expect(tags.compareDocumentPosition(box) & after).toBeTruthy()
    expect(box.compareDocumentPosition(rr) & after).toBeTruthy()
  })
})
