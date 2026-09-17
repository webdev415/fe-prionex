/**
 * KAN-1054 — the "Without RR" checkbox in the client list's RR status filter.
 *
 * Renders the real `ClientFiltersBar` rather than asserting on the constants:
 * the constants say what the option list contains, this says what an operator
 * can actually click and what the bar emits when they do. The value it emits
 * is 0, which is falsy in JS — the kind of thing that survives a unit test of
 * the array and dies somewhere in the middle of a component.
 *
 * Scoped to the RR block, matching the sibling chain-filter tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientFiltersBar } from '../ClientFiltersBar'
import type { ClientFilters } from '../../ClientManagementPage'
import { RR_STATUS, RR_WITHOUT } from '@/features/clients/constants/rrStatus'

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

// The shared i18n mock returns the key for anything it has no entry for, so
// these queries match keys rather than the visible English.
const WITHOUT_RR = 'pages.clients.rrStatus.withoutRr'
const CONNECTED = 'pages.clients.rrStatus.connected'
const DRAFT = 'pages.clients.rrStatus.draft'

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

/** The toggle payload the bar emits — an action envelope, not a whole filter. */
function lastToggle() {
  return onFilterChange.mock.calls.at(-1)?.[0] as unknown as {
    _action?: string
    _value?: number
    _checked?: boolean
  }
}

describe('RR status filter — "Without RR" (KAN-1054)', () => {
  beforeEach(() => onFilterChange.mockClear())

  it('renders a seventh checkbox alongside the six statuses (AC1)', () => {
    setup()

    expect(screen.getByRole('checkbox', { name: WITHOUT_RR })).toBeInTheDocument()
    // ...and the originals are all still there (AC6).
    for (const key of [
      'draft',
      'connected',
      'violated',
      'cancelled',
      'completed',
      'completedEarly',
    ]) {
      expect(
        screen.getByRole('checkbox', { name: `pages.clients.rrStatus.${key}` })
      ).toBeInTheDocument()
    }
  })

  it('is unchecked by default (AC7)', () => {
    setup()
    expect(screen.getByRole('checkbox', { name: WITHOUT_RR })).not.toBeChecked()
  })

  it('emits the pseudo-status 0 when ticked, despite 0 being falsy', () => {
    setup()
    fireEvent.click(screen.getByRole('checkbox', { name: WITHOUT_RR }))

    const toggle = lastToggle()
    expect(toggle._action).toBe('toggleRrStatus')
    expect(toggle._value).toBe(RR_WITHOUT)
    expect(toggle._value).toBe(0)
    expect(toggle._checked).toBe(true)
  })

  it('shows as checked when the filter already holds it', () => {
    setup({ rrStatusIds: [RR_WITHOUT] })
    expect(screen.getByRole('checkbox', { name: WITHOUT_RR })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: CONNECTED })).not.toBeChecked()
  })

  it('coexists with a picked status rather than replacing it (AC3)', () => {
    setup({ rrStatusIds: [RR_WITHOUT, RR_STATUS.Connected] })

    expect(screen.getByRole('checkbox', { name: WITHOUT_RR })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: CONNECTED })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: DRAFT })).not.toBeChecked()
  })

  it('can be unticked again', () => {
    setup({ rrStatusIds: [RR_WITHOUT] })
    fireEvent.click(screen.getByRole('checkbox', { name: WITHOUT_RR }))

    const toggle = lastToggle()
    expect(toggle._value).toBe(RR_WITHOUT)
    expect(toggle._checked).toBe(false)
  })

  it('leaves the existing statuses toggling exactly as before (AC6)', () => {
    setup()
    fireEvent.click(screen.getByRole('checkbox', { name: CONNECTED }))

    const toggle = lastToggle()
    expect(toggle._action).toBe('toggleRrStatus')
    expect(toggle._value).toBe(RR_STATUS.Connected)
    expect(toggle._checked).toBe(true)
  })
})
