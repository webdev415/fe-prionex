/**
 * The "Creditor / Seller" filter asks only for the active project's sellers
 * (story 17-56, Р-6/Р-7/Р-8).
 *
 * The seller endpoint narrows the list to sellers whose debts belong to the
 * project's clients — but only when asked. Without `project_id` the filter
 * showed the whole seller directory in every project, other portfolios
 * included. A project without debts gets an empty row: the label stays, no
 * items and no "+ N more". The number in brackets is the seller id, not a count.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { ClientFiltersBar } from '../ClientFiltersBar'
import type { ClientFilters } from '../../ClientManagementPage'

const PORTFOLIO = 'pages.clients.filters.portfolio'

const { useSellersMock } = vi.hoisted(() => ({ useSellersMock: vi.fn() }))

vi.mock('@/features/taChains', () => ({
  useTAChains: () => ({ data: { items: [] } }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: [] } }),
}))
vi.mock('@/features/sellers/hooks/useSellers', () => ({
  useSellers: useSellersMock,
}))
vi.mock('@/features/tags/hooks/useTags', () => ({
  useTags: () => ({ data: [], isLoading: false }),
  useSegments: () => ({ data: { items: [] }, isLoading: false }),
}))

function setActiveProject(projectId: string | null) {
  useAuthStore.setState({
    user: {
      id: '1',
      projects: [
        { id: '1', name: 'Project 1', country: 'UA', roles: [] },
        { id: '3', name: 'Project 3', country: 'CA', roles: [] },
      ],
      active_project_id: projectId,
    } as unknown as User,
  })
}

function renderBar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ClientFiltersBar filters={{} as ClientFilters} onFilterChange={vi.fn()} />
    </QueryClientProvider>
  )
}

function lastSellersParams() {
  return useSellersMock.mock.calls.at(-1)?.[0]
}

describe('ClientFiltersBar — sellers of the active project only', () => {
  beforeEach(() => {
    useSellersMock.mockReset()
    useSellersMock.mockReturnValue({ data: { sellers: [] }, isLoading: false })
  })

  afterEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('S-1: asks for the sellers of the active project', () => {
    setActiveProject('3')
    renderBar()

    expect(lastSellersParams()).toEqual({ is_active: true, limit: 1000, project_id: 3 })
  })

  it('S-2: follows a project switch', () => {
    setActiveProject('3')
    renderBar()

    act(() => setActiveProject('1'))

    expect(lastSellersParams()).toEqual({ is_active: true, limit: 1000, project_id: 1 })
  })

  it('S-3: sends no project when there is no active project', () => {
    setActiveProject(null)
    renderBar()

    expect(lastSellersParams()).toEqual({ is_active: true, limit: 1000 })
    expect(lastSellersParams()?.project_id).toBeUndefined()
  })

  it('S-4: a project without sellers keeps only the label — no items, no "+ N more"', () => {
    setActiveProject('3')
    renderBar()

    const row = within(screen.getByText(PORTFOLIO).parentElement as HTMLElement)
    expect(row.queryAllByRole('checkbox')).toHaveLength(0)
    expect(row.queryByText(/\+\s*\d+\s*more/)).not.toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'more' })).not.toBeInTheDocument()
  })

  it('S-5: labels a seller with its id in brackets', () => {
    useSellersMock.mockReturnValue({
      data: {
        sellers: [
          { id: 3, seller_name: 'Seller A' },
          { id: 5, seller_name: 'Seller B' },
        ],
      },
      isLoading: false,
    })
    setActiveProject('3')
    renderBar()

    expect(screen.getByText('Seller A (3)')).toBeInTheDocument()
    expect(screen.getByText('Seller B (5)')).toBeInTheDocument()
  })
})
