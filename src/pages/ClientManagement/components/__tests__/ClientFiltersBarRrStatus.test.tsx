/**
 * The RR status group's "×" clear button.
 *
 * Every other filter on this bar that can be cleared in one click sits inside a
 * control -- an input, a date field, a dropdown -- that hosts the ×. RR status
 * is rendered as bare checkboxes with nothing to host it, so the button is
 * placed after the last checkbox instead, and follows the same opt-in rule the
 * others do: it appears only when there is a selection to clear.
 *
 * Scoped to this one control, like the chain and verified-payment suites beside
 * it: the rest of the bar has its own hooks and would fail here for unrelated
 * reasons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientFiltersBar } from '../ClientFiltersBar'
import type { ClientFilters } from '../../ClientManagementPage'

// The shared i18n mock (src/test/setup.ts) returns the translation KEY for any
// key it has no entry for -- the inline English fallback in `t(key, fallback)`
// is not consulted. So the button is found by its key, not by "Clear RR status".
const CLEAR_RR_STATUS = 'pages.clients.filters.clearRrStatus'

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

/** Last call's payload -- the bar rebuilds the whole filter object each time. */
function lastFilters(): Partial<ClientFilters> {
  return onFilterChange.mock.calls.at(-1)?.[0] ?? {}
}

describe('the RR status clear button', () => {
  beforeEach(() => {
    onFilterChange.mockClear()
  })

  it('is absent while nothing is selected', () => {
    // Opt-in, like the × on the inputs and dropdowns: a clear button with
    // nothing to clear is noise.
    setup({ rrStatusIds: [] })

    expect(screen.queryByRole('button', { name: CLEAR_RR_STATUS })).not.toBeInTheDocument()
  })

  it('appears once a status is ticked', () => {
    setup({ rrStatusIds: [2] })

    expect(screen.getByRole('button', { name: CLEAR_RR_STATUS })).toBeInTheDocument()
  })

  it('clears every ticked status in one click', () => {
    setup({ rrStatusIds: [1, 2] })

    fireEvent.click(screen.getByRole('button', { name: CLEAR_RR_STATUS }))

    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(lastFilters().rrStatusIds).toEqual([])
  })

  it('leaves the filters beside it alone', () => {
    // The bar rebuilds the whole object, so a clear that dropped its
    // neighbours would look like it worked while quietly resetting the page.
    setup({ rrStatusIds: [2], tagIds: [7], unassignedOnly: true })

    fireEvent.click(screen.getByRole('button', { name: CLEAR_RR_STATUS }))

    const next = lastFilters()
    expect(next.rrStatusIds).toEqual([])
    expect(next.tagIds).toEqual([7])
    expect(next.unassignedOnly).toBe(true)
  })
})
