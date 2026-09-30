/**
 * The "Creditor / Seller" filter asks only for the active project's sellers
 * (story 17-56, Р-6/Р-7/Р-8).
 *
 * The seller endpoint narrows the list to sellers whose debts belong to the
 * project's clients — but only when asked. Without `project_id` the filter
 * showed the whole seller directory in every project, other portfolios
 * included. A project without debts gets an empty row: the label stays, no
 * items and no "+ N more". The number in brackets is the seller id, not a count.
 *
 * The door (api-prionex `services/client/app/routers/sellers.py:47-87`, main):
 * `project_id: Optional[int] = Query(...)`, a foreign project → 403, and
 * `SellerService.list_sellers(project_id=…)` keeps only sellers with debts of
 * that project's clients. DEV 29.09: total 3 without it, 0 with an empty project.
 *
 * A seller picked in another project is not in this project's list, so the bar
 * drops it once the list has arrived — otherwise it stays an invisible filter
 * nobody can untick. While the list loads, nothing changes.
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

function renderBar(filters = {} as ClientFilters, onFilterChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ClientFiltersBar filters={filters} onFilterChange={onFilterChange} />
    </QueryClientProvider>
  )
}

const PROJECT_SELLERS = {
  data: {
    sellers: [
      { id: 1, seller_name: 'Seller A' },
      { id: 2, seller_name: 'Seller B' },
      { id: 3, seller_name: 'Seller C' },
    ],
  },
  isLoading: false,
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

  it("S-6: drops a seller picked in another project once the project's list has arrived", () => {
    useSellersMock.mockReturnValue(PROJECT_SELLERS)
    setActiveProject('3')
    const onFilterChange = vi.fn()
    renderBar({ portfolio: [7] } as ClientFilters, onFilterChange)

    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onFilterChange).toHaveBeenCalledWith({ portfolio: [] })
  })

  it("S-7: keeps a picked seller that is in the project's list", () => {
    useSellersMock.mockReturnValue(PROJECT_SELLERS)
    setActiveProject('3')
    const onFilterChange = vi.fn()
    renderBar({ portfolio: [3] } as ClientFilters, onFilterChange)

    expect(onFilterChange).not.toHaveBeenCalled()
  })

  it("S-8: changes nothing while the project's list is still loading", () => {
    useSellersMock.mockReturnValue({ data: undefined, isLoading: true })
    setActiveProject('3')
    const onFilterChange = vi.fn()
    renderBar({ portfolio: [7] } as ClientFilters, onFilterChange)

    expect(onFilterChange).not.toHaveBeenCalled()
  })

  it("S-9: drops only the foreign seller and keeps the project's own one", () => {
    useSellersMock.mockReturnValue(PROJECT_SELLERS)
    setActiveProject('3')
    const onFilterChange = vi.fn()
    renderBar({ portfolio: [7, 3] } as ClientFilters, onFilterChange)

    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onFilterChange).toHaveBeenCalledWith({ portfolio: [3] })
  })
})
