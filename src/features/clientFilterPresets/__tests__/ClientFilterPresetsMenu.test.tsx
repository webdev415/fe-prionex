/**
 * The client-list end of the feature (#1100, Part 2).
 *
 * What matters here is that the preset is *resolved at the click*, not stored
 * resolved: the filters handed to the page must be concrete values derived from
 * the saved rules. And it is single-select — picking a preset replaces the view,
 * so applying a second one must not leave the first still marked.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: '1', active_group_id: 2, active_department_id: 8 } }),
}))
vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({
    data: [
      { id: 1, group_id: 2, department_id: 8 },
      { id: 2, group_id: 2, department_id: 8 },
      { id: 3, group_id: 9, department_id: 9 },
    ],
  }),
}))

// The endpoint is stubbed rather than the hook: that keeps the query wiring —
// including the menu only fetching once it is opened — inside what these tests
// exercise.
const getClientFilterPresets = vi.hoisted(() => vi.fn())
vi.mock('../api/clientFilterPresetsApi', () => ({
  getClientFilterPresets,
  createClientFilterPreset: vi.fn(),
  updateClientFilterPreset: vi.fn(),
  deleteClientFilterPreset: vi.fn(),
}))

const { ClientFilterPresetsMenu } = await import('../components/ClientFilterPresetsMenu')

beforeEach(() => {
  getClientFilterPresets.mockReset()
  getClientFilterPresets.mockResolvedValue({ presets: [] })
})

/** What the endpoint will return for this test. */
function seed(presets: Array<{ id: number; name: string; params: object }>) {
  getClientFilterPresets.mockResolvedValue({ presets })
}

function renderMenu(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(ui, { wrapper })
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId('client-filter-presets'))
  // The list is fetched on open, so every assertion after this waits for it.
  await screen.findByRole('menu')
}

describe('ClientFilterPresetsMenu', () => {
  it('points the operator at their profile when they have no presets', async () => {
    const user = userEvent.setup()
    renderMenu(<ClientFilterPresetsMenu projectId={1} onApply={vi.fn()} hasActiveFilters />)

    await open(user)

    expect(screen.getByText('pages.clients.presets.empty')).toBeTruthy()
  })

  it('resolves the preset at the moment it is applied', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    seed([
      {
        id: 1,
        name: 'This month',
        params: {
          dateOfSale: { from: { mode: 'startOfMonth' }, to: { mode: 'today' } },
          dpd: { from: 30 },
        },
      },
    ])
    renderMenu(<ClientFilterPresetsMenu projectId={1} onApply={onApply} hasActiveFilters />)

    await open(user)
    await user.click(await screen.findByText('This month'))

    const filters = onApply.mock.lastCall?.[0] as Record<string, unknown>
    const today = new Date()
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    // Concrete dates, derived from the rules rather than saved alongside them.
    expect(filters.dateOfSaleFrom).toBe(ymd(new Date(today.getFullYear(), today.getMonth(), 1)))
    expect(filters.dateOfSaleTo).toBe(ymd(today))
    expect(filters.dpdRangeFrom).toBe(30)
  })

  it('resolves a relative employee scope against the directory', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    seed([{ id: 1, name: 'My team', params: { responsibleEmployee: { scope: 'myGroup' } } }])
    renderMenu(<ClientFilterPresetsMenu projectId={1} onApply={onApply} hasActiveFilters />)

    await open(user)
    await user.click(await screen.findByText('My team'))

    const filters = onApply.mock.lastCall?.[0] as Record<string, unknown>
    // Operator 3 is in another group, so the preset covers 1 and 2 only.
    expect(filters.responsibleEmployeeIds).toEqual([1, 2])
  })

  it('omits the filters a preset leaves unset so they are cleared, not kept', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    seed([{ id: 1, name: 'DPD only', params: { dpd: { from: 10 } } }])
    renderMenu(<ClientFilterPresetsMenu projectId={1} onApply={onApply} hasActiveFilters />)

    await open(user)
    await user.click(await screen.findByText('DPD only'))

    const filters = onApply.mock.lastCall?.[0] as Record<string, unknown>
    expect(Object.keys(filters)).toEqual(['dpdRangeFrom'])
  })

  it('marks only the preset currently applied', async () => {
    const user = userEvent.setup()
    seed([
      { id: 1, name: 'First', params: { dpd: { from: 1 } } },
      { id: 2, name: 'Second', params: { dpd: { from: 2 } } },
    ])
    renderMenu(<ClientFilterPresetsMenu projectId={1} onApply={vi.fn()} hasActiveFilters />)

    await open(user)
    await user.click(await screen.findByText('First'))
    await open(user)
    expect(screen.getByText('pages.clients.presets.applied')).toBeTruthy()

    // Single-select: the second replaces the first rather than adding to it.
    await user.click(await screen.findByText('Second'))
    await open(user)
    expect(screen.getAllByText('pages.clients.presets.applied')).toHaveLength(1)
  })

  it('drops the applied mark once the filters are cleared', async () => {
    const user = userEvent.setup()
    seed([{ id: 1, name: 'First', params: { dpd: { from: 1 } } }])
    const { rerender } = renderMenu(
      <ClientFilterPresetsMenu projectId={1} onApply={vi.fn()} hasActiveFilters />
    )

    await open(user)
    await user.click(await screen.findByText('First'))
    await open(user)
    expect(screen.getByText('pages.clients.presets.applied')).toBeTruthy()

    // Clear All empties the filters without telling this component. A mark left
    // standing would claim a view that is no longer on screen.
    rerender(<ClientFilterPresetsMenu projectId={1} onApply={vi.fn()} hasActiveFilters={false} />)
    expect(screen.queryByText('pages.clients.presets.applied')).toBeNull()
  })

  it('does not fetch the list until the menu is opened', async () => {
    const user = userEvent.setup()
    seed([{ id: 1, name: 'Mine', params: {} }])
    renderMenu(<ClientFilterPresetsMenu projectId={1} onApply={vi.fn()} hasActiveFilters />)

    // Most visits to the client list never open this menu, and the button
    // itself needs nothing from the list.
    expect(getClientFilterPresets).not.toHaveBeenCalled()

    await open(user)
    expect(getClientFilterPresets).toHaveBeenCalled()
    expect(await screen.findByText('Mine')).toBeTruthy()
  })

  it('says so when the list could not be loaded', async () => {
    const user = userEvent.setup()
    getClientFilterPresets.mockRejectedValue(new Error('offline'))
    renderMenu(<ClientFilterPresetsMenu projectId={1} onApply={vi.fn()} hasActiveFilters />)

    await open(user)

    // Pointing at the profile here would send the operator off to recreate
    // presets they already have.
    expect(await screen.findByText('pages.clients.presets.loadFailed')).toBeTruthy()
    expect(screen.queryByText('pages.clients.presets.empty')).toBeNull()
  })
})
