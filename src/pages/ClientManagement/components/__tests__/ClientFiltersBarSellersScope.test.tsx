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
 * A seller picked in another project (a link, a saved set, a project switch) is
 * not in this project's list. The clients page — not the folding filter bar —
 * drops it once the complete list has arrived, so it never filters the clients
 * request unseen with the bar folded. A list still loading, or a page cut short
 * by the limit, changes nothing. The saved filter set is kept per user and
 * project, and a set left with no active filter is forgotten, not restored on
 * the next visit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { ClientFiltersBar } from '../ClientFiltersBar'
import { ClientManagementPage, type ClientFilters } from '../../ClientManagementPage'

const PORTFOLIO = 'pages.clients.filters.portfolio'

const { useSellersMock, useClientsMock, idleMutation } = vi.hoisted(() => ({
  useSellersMock: vi.fn(),
  useClientsMock: vi.fn(),
  idleMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/features/taChains', () => ({
  useTAChains: () => ({ data: { items: [] } }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: [] } }),
}))
vi.mock('@/features/sellers/hooks/useSellers', () => ({
  useSellers: useSellersMock,
}))
vi.mock('@/features/tags/hooks/useTags', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTags: () => ({ data: [], isLoading: false }),
  useSegments: () => ({ data: { items: [] }, isLoading: false }),
}))

// The clients page: its data sources are stubbed, its filter state, saved set
// and seller check are real.
vi.mock('@/features/clients/hooks/useClients', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useClients: useClientsMock,
  useAssignClient: idleMutation,
  useBulkAssignClients: idleMutation,
}))
vi.mock('@/features/users/hooks/useUsers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useOperators: () => ({ data: [] }),
}))
vi.mock('@/features/clients/hooks/useConfig', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePriorityThresholds: () => ({ data: undefined }),
}))
vi.mock('@/features/scoring/hooks/useV3Scores', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useV3UiEnabled: () => false,
  useV3ClientRollup: () => ({ data: undefined }),
  useV3ClientSummary: () => ({ data: undefined }),
  useV3BucketCounts: () => ({ data: undefined }),
}))
vi.mock('@/features/ubki', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useUbkiAvailable: () => true,
  useBulkOptOutUbki: idleMutation,
  useBulkSubmitByClients: idleMutation,
}))
vi.mock('@/pages/ClientManagement/hooks/useOperatorFilterOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useOperatorFilterOptions: () => ({
    employeeOptions: [],
    interactionUserOptions: [],
    searcherOptions: [],
    isReady: true,
  }),
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
    total: 3,
  },
  isLoading: false,
}

function lastSellersParams() {
  return useSellersMock.mock.calls.at(-1)?.[0]
}

function renderPage(url = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <ClientManagementPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/** Every clients request the page made, in order. */
function clientsRequests() {
  return useClientsMock.mock.calls.map(([params]) => params as Record<string, unknown>)
}

/** The page restores a saved set on the next tick — let it. */
async function afterRestore() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
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

describe('ClientManagementPage — a seller of another project never filters unseen', () => {
  const SAVED_IN_PROJECT_3 = 'client-filters-state-1-3'

  beforeEach(() => {
    useSellersMock.mockReset()
    useSellersMock.mockReturnValue(PROJECT_SELLERS)
    useClientsMock.mockReset()
    useClientsMock.mockReturnValue({
      data: { items: [], total: 0, total_pages: 1 },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    })
    localStorage.clear()
  })

  afterEach(() => {
    useAuthStore.setState({ user: null })
    localStorage.clear()
  })

  it('S-6: drops a seller of another project that came in a link, with the filter bar folded', () => {
    setActiveProject('3')
    renderPage('/?sellers=7')

    // The bar is folded: nothing on screen shows the seller filter.
    expect(screen.queryByText(PORTFOLIO)).not.toBeInTheDocument()
    // The link did bring the seller in …
    expect(clientsRequests().some((p) => p.seller_ids === '7')).toBe(true)
    // … and once the project's full list is there, the request goes without it.
    expect(clientsRequests().at(-1)?.seller_ids).toBeUndefined()
  })

  it("S-7: keeps a picked seller that is in the project's list", () => {
    setActiveProject('3')
    renderPage('/?sellers=3')

    expect(clientsRequests().every((p) => p.seller_ids === '3')).toBe(true)
  })

  it("S-8: changes nothing while the project's list is still loading", () => {
    useSellersMock.mockReturnValue({ data: undefined, isLoading: true })
    setActiveProject('3')
    renderPage('/?sellers=7')

    expect(clientsRequests().at(-1)?.seller_ids).toBe('7')
  })

  it("S-9: drops only the foreign seller and keeps the project's own one", () => {
    setActiveProject('3')
    renderPage('/?sellers=7,3')

    expect(clientsRequests().at(-1)?.seller_ids).toBe('3')
  })

  it('S-10: a page of sellers cut short by the limit decides nothing', () => {
    useSellersMock.mockReturnValue({
      data: { ...PROJECT_SELLERS.data, total: 250 },
      isLoading: false,
    })
    setActiveProject('3')
    renderPage('/?sellers=7')

    expect(clientsRequests().every((p) => p.seller_ids === '7')).toBe(true)
  })

  it('S-11: a filter set saved in another project is not restored after a project switch', async () => {
    setActiveProject('1')
    const inProject1 = renderPage('/?sellers=2')
    await afterRestore()
    inProject1.unmount()

    setActiveProject('3')
    useClientsMock.mockClear()
    renderPage('/')
    await afterRestore()

    // Seller 2 is in project 3's list too — only the per-project key keeps it out.
    expect(clientsRequests().every((p) => p.seller_ids === undefined)).toBe(true)
    expect(clientsRequests().at(-1)?.responsible_employee_ids).toBe('1')
  })

  it('S-12: restores the filter set saved in the same project', async () => {
    localStorage.setItem(SAVED_IN_PROJECT_3, JSON.stringify({ portfolioFilter: [2] }))
    setActiveProject('3')
    renderPage('/')
    await afterRestore()

    expect(clientsRequests().at(-1)?.seller_ids).toBe('2')
  })

  it('S-13: without an active project the per-user key is read, as before', async () => {
    localStorage.setItem('client-filters-state-1', JSON.stringify({ portfolioFilter: [2] }))
    setActiveProject(null)
    renderPage('/')
    await afterRestore()

    expect(clientsRequests().at(-1)?.seller_ids).toBe('2')
  })

  it('S-14: a saved set whose only filter was a foreign seller is forgotten, not restored next time', async () => {
    localStorage.setItem(SAVED_IN_PROJECT_3, JSON.stringify({ portfolioFilter: [7] }))
    setActiveProject('3')
    const first = renderPage('/')
    await afterRestore()

    expect(clientsRequests().some((p) => p.seller_ids === '7')).toBe(true)
    expect(clientsRequests().at(-1)?.seller_ids).toBeUndefined()
    expect(localStorage.getItem(SAVED_IN_PROJECT_3)).toBeNull()

    first.unmount()
    useClientsMock.mockClear()
    renderPage('/')
    await afterRestore()

    expect(clientsRequests().every((p) => p.seller_ids === undefined)).toBe(true)
  })
})
