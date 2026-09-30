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
 * by the limit, changes nothing; the page asks for the list only while a seller
 * is picked. `total` is the count after the `project_id` filter (the door above),
 * which is what makes `total <= sellers.length` a complete page — the fe cannot
 * pin that contract, S-10 pins the rule on top of it.
 *
 * The saved filter set is kept per user and project. A set left with no active
 * filter keeps only its view (page size, sort): the next visit starts from the
 * default filter in that view. A live project switch — the page stays mounted —
 * sends and saves nothing of the previous project and restores the next
 * project's own set, as a first visit would: the header search is cleared with
 * it, and the loading skeleton covers the switch instead of an empty list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Profiler, type ReactNode } from 'react'
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSearchStore } from '@/stores/searchStore'
import { sellersApi } from '@/features/sellers/api/sellersApi'
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

/** `onCommit` runs after every commit of the page, with its DOM in place. */
function renderPage(url = '/', onCommit = () => {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Profiler id="page" onRender={onCommit}>
          <ClientManagementPage />
        </Profiler>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/** Every clients request the page made, in order — a disabled query makes none. */
function clientsRequests() {
  return useClientsMock.mock.calls
    .filter(([, options]) => (options as { enabled?: boolean } | undefined)?.enabled !== false)
    .map(([params]) => params as Record<string, unknown>)
}

/** The sellers query as react-query answers it: disabled and nothing cached — no data. */
function sellersOf(listOf: (projectId?: number) => typeof PROJECT_SELLERS) {
  return (params?: { project_id?: number }, options?: { enabled?: boolean }) =>
    options?.enabled === false ? { data: undefined, isLoading: false } : listOf(params?.project_id)
}

/** The page's own sellers queries: it passes options, the folding bar does not. */
function pageSellersCalls() {
  return useSellersMock.mock.calls.filter((call) => call.length > 1)
}

/** Switch the project the way ProjectSelector does: the page stays mounted. */
async function switchProjectLive(projectId: string) {
  act(() => setActiveProject(projectId))
  await afterRestore()
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
    useSellersMock.mockImplementation(sellersOf(() => PROJECT_SELLERS))
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
    vi.restoreAllMocks()
    useAuthStore.setState({ user: null })
    useSearchStore.setState({ searchQuery: '', searchType: 'phone' })
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

  it("S-11: a live project switch neither sends nor saves project 1's filters and restores project 3's own set", async () => {
    // Seller 9 exists in project 1 only; seller 2 in both.
    useSellersMock.mockImplementation(
      sellersOf((projectId) =>
        projectId === 1
          ? {
              data: {
                sellers: [
                  { id: 2, seller_name: 'Seller B' },
                  { id: 9, seller_name: 'Seller Z' },
                ],
                total: 2,
              },
              isLoading: false,
            }
          : PROJECT_SELLERS
      )
    )
    localStorage.setItem(
      'client-filters-state-1-1',
      JSON.stringify({ portfolioFilter: [2, 9], tagIdsFilter: [5] })
    )
    localStorage.setItem(
      SAVED_IN_PROJECT_3,
      JSON.stringify({ portfolioFilter: [3], tagIdsFilter: [8] })
    )
    setActiveProject('1')
    renderPage('/')
    await afterRestore()
    expect(clientsRequests().at(-1)).toMatchObject({ seller_ids: '2,9', tag_ids: '5' })

    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    useClientsMock.mockClear()
    await switchProjectLive('3')

    // (a) No request after the switch carries project 1's sellers or tag.
    expect(
      clientsRequests().every(
        (p) =>
          [undefined, '3'].includes(p.seller_ids as string) &&
          [undefined, '8'].includes(p.tag_ids as string)
      )
    ).toBe(true)
    // (b) Nothing of project 1 was ever written under project 3's key.
    const underProject3 = setItem.mock.calls
      .filter(([key]) => key === SAVED_IN_PROJECT_3)
      .map(([, value]) => JSON.parse(value))
    expect(
      underProject3.every(
        (set) => !set.portfolioFilter?.includes(9) && !set.tagIdsFilter?.includes(5)
      )
    ).toBe(true)
    // (c) Project 3's own set is back, exactly as saved — no "assigned to me" on top.
    expect(clientsRequests().at(-1)).toMatchObject({ seller_ids: '3', tag_ids: '8' })
    expect(clientsRequests().at(-1)?.responsible_employee_ids).toBeUndefined()
  })

  it('S-15: a filter set saved in another project is not restored on a fresh mount in the next one', async () => {
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

  it('S-14: a saved set whose only filter was a foreign seller keeps just its view; the next visit starts from the default filter in that view', async () => {
    localStorage.setItem(
      SAVED_IN_PROJECT_3,
      JSON.stringify({ portfolioFilter: [7], rowsPerPage: 50, sortBy: 'debt', sortOrder: 'asc' })
    )
    setActiveProject('3')
    const first = renderPage('/')
    await afterRestore()

    expect(clientsRequests().some((p) => p.seller_ids === '7')).toBe(true)
    expect(clientsRequests().at(-1)?.seller_ids).toBeUndefined()
    expect(JSON.parse(localStorage.getItem(SAVED_IN_PROJECT_3) ?? 'null')).toEqual({
      rowsPerPage: 50,
      sortBy: 'debt',
      sortOrder: 'asc',
    })

    first.unmount()
    useClientsMock.mockClear()
    renderPage('/')
    await afterRestore()

    expect(clientsRequests().every((p) => p.seller_ids === undefined)).toBe(true)
    expect(clientsRequests().at(-1)).toMatchObject({
      limit: 50,
      sort_by: 'total_debt',
      sort_order: 'asc',
      responsible_employee_ids: '1',
    })
  })

  it('S-16: a live switch into a project without a saved set starts from "assigned to me"; the link filters of project 1 stay out', async () => {
    setActiveProject('1')
    renderPage('/?sellers=2&tags=5')
    await afterRestore()
    expect(clientsRequests().at(-1)).toMatchObject({ seller_ids: '2', tag_ids: '5' })

    useClientsMock.mockClear()
    await switchProjectLive('3')
    // Past the URL debounce: project 1's params leave the address, nothing comes back.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400))
    })

    expect(
      clientsRequests().every((p) => p.seller_ids === undefined && p.tag_ids === undefined)
    ).toBe(true)
    expect(clientsRequests().at(-1)?.responsible_employee_ids).toBe('1')
    expect(JSON.parse(localStorage.getItem(SAVED_IN_PROJECT_3) ?? '{}')).toMatchObject({
      portfolioFilter: [],
      tagIdsFilter: [],
      responsibleEmployeeIdsFilter: [1],
    })
  })

  it('S-17: the page asks for the sellers list only while a seller is picked', async () => {
    setActiveProject('3')
    const folded = renderPage('/')
    await afterRestore()

    expect(pageSellersCalls().length).toBeGreaterThan(0)
    expect(pageSellersCalls().every(([, options]) => options?.enabled === false)).toBe(true)

    folded.unmount()
    useSellersMock.mockClear()
    // The project's own seller stays picked, so the list stays asked for.
    renderPage('/?sellers=3')

    expect(pageSellersCalls().at(-1)?.[1]).toEqual({ enabled: true })
  })

  it('S-18: a user who arrives after the page mounted is not a project switch — the link filter stays', async () => {
    useAuthStore.setState({ user: null })
    renderPage('/?sellers=2')
    await switchProjectLive('3')

    expect(clientsRequests().at(-1)?.seller_ids).toBe('2')
  })

  it("S-20: a live switch with a header search leaves project 3's saved set as it was and restores it; the search is cleared", async () => {
    const savedInProject3 = { portfolioFilter: [3], tagIdsFilter: [8] }
    localStorage.setItem(SAVED_IN_PROJECT_3, JSON.stringify(savedInProject3))
    setActiveProject('1')
    renderPage('/')
    await afterRestore()
    act(() => useSearchStore.setState({ searchQuery: '380501234567', searchType: 'phone' }))
    // Control: without a switch the header search does reach the request.
    expect(clientsRequests().at(-1)).toMatchObject({ q: '380501234567', search_type: 'phone' })

    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    useClientsMock.mockClear()
    await switchProjectLive('3')

    // (a) Project 3's set is never overwritten by the search with empty filters.
    // The restore saves it again in full, so compare the set's own filters.
    const underProject3 = setItem.mock.calls
      .filter(([key]) => key === SAVED_IN_PROJECT_3)
      .map(([, value]) => JSON.parse(value))
    expect(underProject3.every((set) => !set.searchQuery)).toBe(true)
    expect(JSON.parse(localStorage.getItem(SAVED_IN_PROJECT_3) ?? '{}')).toMatchObject(
      savedInProject3
    )
    // (b) The set is restored, without the search and without "assigned to me".
    expect(clientsRequests().every((p) => p.q === undefined)).toBe(true)
    expect(clientsRequests().at(-1)).toMatchObject({ seller_ids: '3', tag_ids: '8' })
    expect(clientsRequests().at(-1)?.responsible_employee_ids).toBeUndefined()
    // (c) The header search is gone from the store.
    expect(useSearchStore.getState().searchQuery).toBe('')
  })

  it('S-21: a live project switch shows the loading skeleton, not an empty list, until the request of project 3 goes', async () => {
    // As ProjectSelector leaves react-query: the cache dropped, so a disabled
    // clients query has nothing and is not loading.
    useClientsMock.mockImplementation((_params, options?: { enabled?: boolean }) =>
      options?.enabled === false
        ? { data: undefined, isLoading: false, isFetching: false, isError: false, error: null }
        : {
            data: { items: [], total: 0, total_pages: 1 },
            isLoading: false,
            isFetching: false,
            isError: false,
            error: null,
          }
    )
    // Every commit of the page: was its clients query off, and did the screen
    // show the empty list?
    const commits: { queryOff: boolean; emptyList: boolean }[] = []
    const onCommit = () =>
      commits.push({
        queryOff:
          (useClientsMock.mock.calls.at(-1)?.[1] as { enabled?: boolean } | undefined)?.enabled ===
          false,
        emptyList: screen.queryByText('pages.clients.noClientsFound') !== null,
      })
    setActiveProject('1')
    renderPage('/', onCommit)
    await afterRestore()

    commits.length = 0
    await switchProjectLive('3')

    // The switch window was on screen (the query off) …
    expect(commits.some((c) => c.queryOff)).toBe(true)
    // … and never as "no clients found".
    expect(commits.filter((c) => c.queryOff && c.emptyList)).toEqual([])
    // Once project 3's request has gone, its (empty) result is shown.
    expect(screen.getByText('pages.clients.noClientsFound')).toBeInTheDocument()
  })
})

describe('useSellers — the page switches its request off', () => {
  it('S-19: a disabled sellers query sends no request; enabled, it does', async () => {
    const { useSellers } = await vi.importActual<
      typeof import('@/features/sellers/hooks/useSellers')
    >('@/features/sellers/hooks/useSellers')
    const getSellers = vi
      .spyOn(sellersApi, 'getSellers')
      .mockResolvedValue({ sellers: [], total: 0 } as unknown as Awaited<
        ReturnType<typeof sellersApi.getSellers>
      >)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSellers({ project_id: 3 }, { enabled }),
      { wrapper, initialProps: { enabled: false } }
    )
    await afterRestore()
    expect(getSellers).not.toHaveBeenCalled()

    rerender({ enabled: true })
    await waitFor(() => expect(getSellers).toHaveBeenCalledWith({ project_id: 3 }))
    getSellers.mockRestore()
  })
})
