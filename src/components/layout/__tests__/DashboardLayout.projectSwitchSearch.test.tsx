import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSearchStore } from '@/stores/searchStore'

/**
 * The header search after a project switch (story 17-56b, bot review round 1, M-1).
 *
 * The switcher (profile page) clears the applied search, but the header keeps
 * state of its own: the text in the field, its type, the results of the last
 * search and their panel. Left alone they outlived the switch — the previous
 * project's text sat in the field, and focusing it reopened the previous
 * project's results from the header's cache without a request. The switcher now
 * bumps `switchNonce` in the search store, and the header drops all four on it.
 * The real SearchBar and SearchResults are mounted: the field and the panel are
 * what the operator sees. Control: without a switch — "View all results" applies
 * the search to the store — the field keeps its text.
 */
const mockLocation = { pathname: '/dashboard', search: '', hash: '', state: null }

// One `t` for every render, as i18next gives it. The shared mock hands out a new
// function per call, and the real SearchBar re-runs its effect on every new
// `onSearchChange` (the header's search callbacks depend on `t`): an endless loop.
vi.mock('react-i18next', () => {
  const t = (key: string) => key
  const i18n = { language: 'en', changeLanguage: vi.fn() }
  return {
    useTranslation: () => ({ t, i18n }),
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => mockLocation,
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: { id: '7', permissions: ['manage_settings'] } }),
}))
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: '7', permissions: ['manage_settings'], asterisk_extension: '2001' },
    logout: vi.fn(),
    isImpersonating: false,
    impersonatedUser: null,
    exitImpersonation: vi.fn(),
  }),
}))
vi.mock('@/features/auth/components/ImpersonationBanner', () => ({
  ImpersonationBanner: () => null,
}))
vi.mock('@/features/scoring/hooks/useV3Scores', () => ({ useV3UiEnabled: () => false }))
vi.mock('@/hooks', () => ({ usePermissionRefresh: () => undefined }))
vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: () => true,
  useHasAnyPermission: () => true,
}))
vi.mock('@/features/lawyerWorkplace', () => ({ useLegalInboxSummary: () => ({ data: undefined }) }))
vi.mock('@/pages/LawyerWorkplace/components/LawyerWorkplaceHeaderNav', () => ({
  LawyerWorkplaceHeaderNav: () => null,
}))
vi.mock('@/features/operatorAnalytics', () => ({
  TrackingProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  RouteChangeTracker: () => null,
}))
const searchClients = vi.hoisted(() => vi.fn())
vi.mock('@/api/clientSearchApi', () => ({
  searchClients,
  mapPriorityLevel: () => 'low',
}))
vi.mock('../Sidebar', () => ({ Sidebar: () => null }))
vi.mock('../UserProfile', () => ({ UserProfile: () => null }))
vi.mock('../NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('../ThemeModeToggle', () => ({ ThemeModeToggle: () => null }))
vi.mock('../MinimizedCallBubble', () => ({ MinimizedCallBubble: () => null }))
vi.mock('../MinimizedChainExecutorBubble', () => ({ MinimizedChainExecutorBubble: () => null }))
vi.mock('@/features/calls/components/IncomingCallWindowContainer', () => ({
  IncomingCallWindowContainer: () => null,
}))
vi.mock('@/pages/ClientManagement/components/CallDialogModal', () => ({
  CallDialogModal: () => null,
}))
vi.mock('@/pages/ClientManagement/components/CallRecordingModal', () => ({
  CallRecordingModal: () => null,
}))
vi.mock('@/features/calls/hooks/useIncomingCall', () => ({
  useIncomingCall: () => ({ incomingCall: null, dismissIncomingCall: vi.fn() }),
}))
vi.mock('@/features/calls/hooks/useCanShowIncomingPopup', () => ({
  useCanShowIncomingPopup: () => false,
}))
vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditSwitches: () => ({ data: undefined }),
  useCreditSectionEnabled: () => true,
}))

import { DashboardLayout } from '../DashboardLayout'

/** One client found in the previous project; the name is what the panel shows. */
const FOUND_IN_PROJECT_1 = 'Client Of Project-One'

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardLayout>
        <div />
      </DashboardLayout>
    </QueryClientProvider>
  )
}

function searchField() {
  return screen.getByPlaceholderText('search.placeholder')
}

/** The desktop type selector: the one that shows the current type's label. */
function typeSelector() {
  const selector = screen
    .getAllByLabelText('components.searchBar.searchType')
    .find((button) => button.textContent)
  if (!selector) throw new Error('no search type selector with a label')
  return selector
}

function chooseSearchType(label: string) {
  fireEvent.pointerDown(typeSelector(), { button: 0, ctrlKey: false, pointerType: 'mouse' })
  const item = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes(label))
  if (!item) throw new Error(`no search type ${label}`)
  fireEvent.click(item)
}

/** A search by name in the header, its results panel open. */
async function searchByName() {
  renderLayout()
  chooseSearchType('search.fullName')
  fireEvent.change(searchField(), { target: { value: 'Project-One' } })
  expect(await screen.findByText(FOUND_IN_PROJECT_1)).toBeInTheDocument()
  expect(searchClients).toHaveBeenCalledWith(
    expect.objectContaining({ q: 'Project-One', search_type: 'name' })
  )
  expect(searchField()).toHaveValue('Project-One')
  expect(typeSelector()).toHaveTextContent('search.fullName')
}

describe('DashboardLayout — a project switch takes the header search with it', () => {
  beforeEach(() => {
    searchClients.mockReset()
    searchClients.mockResolvedValue({
      items: [
        {
          id: 101,
          last_name: 'Client',
          first_name: 'Of',
          middle_name: 'Project-One',
          total_debt: 0,
          phones: [],
          email_primary: null,
          priority_level: 'low',
          priority_score: 0,
          contact_source: null,
        },
      ],
      total: 1,
      query: 'Project-One',
      search_type: 'name',
    })
    useSearchStore.setState({ searchQuery: '', searchType: 'phone', switchNonce: 0 })
  })

  afterEach(() => {
    useSearchStore.setState({ searchQuery: '', searchType: 'phone', switchNonce: 0 })
  })

  it("DL-1: a switch empties the field, puts the type back and closes the panel with the previous project's results", async () => {
    await searchByName()

    act(() => useSearchStore.getState().resetForProjectSwitch())

    await waitFor(() => expect(searchField()).toHaveValue(''))
    expect(typeSelector()).toHaveTextContent('search.phoneNumber')
    expect(screen.queryByText(FOUND_IN_PROJECT_1)).not.toBeInTheDocument()
  })

  it('DL-2: control — without a switch the field keeps its text when the search is applied to the clients page', async () => {
    await searchByName()

    fireEvent.click(screen.getByText('search.viewAllResults'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(useSearchStore.getState()).toMatchObject({
      searchQuery: 'Project-One',
      searchType: 'name',
      switchNonce: 0,
    })
    expect(searchField()).toHaveValue('Project-One')
    expect(typeSelector()).toHaveTextContent('search.fullName')
  })
})
