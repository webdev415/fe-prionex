import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ApiUser } from '@/features/users/types'

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const rows = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('@/features/users/hooks/useUsers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/users/hooks/useUsers')>()),
  useUsers: () => ({
    data: {
      users: rows.value,
      pagination: { page: 1, page_size: 10, total_count: rows.value.length, total_pages: 1 },
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useOperators: () => ({ data: undefined }),
}))
vi.mock('@/features/users/hooks/useFilterTemplates', () => ({
  useFilterTemplates: () => ({ data: { templates: [] }, isLoading: false, isError: false }),
  useSaveFilterTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateFilterTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteFilterTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/roles', () => ({ useRoles: () => ({ data: { roles: [] } }) }))
vi.mock('@/features/projects', () => ({ useProjects: () => ({ data: { projects: [] } }) }))
vi.mock('@/features/departments', () => ({
  useDepartments: () => ({ data: { departments: [] } }),
}))
vi.mock('@/features/groups', () => ({ useGroups: () => ({ data: { groups: [] } }) }))
// Phone binding (#1532) reads its own status over the network; by default the
// feature is off, so the table keeps its pre-#1532 shape. Its UI has its own tests.
const appLogin = vi.hoisted(() => ({ available: false }))
vi.mock('@/features/appLogin', () => ({
  AdminAppLoginRevokeModal: () => null,
  AppLoginStatusIcon: () => null,
  isFeatureAvailable: () => appLogin.available,
  useMyAppLoginStatus: () => ({ data: undefined }),
}))
const cardPermission = vi.hoisted(() => ({ granted: true }))

vi.mock('@/hooks/usePermissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePermissions')>()
  return {
    ...actual,
    useHasPermission: (permission: string) =>
      permission === 'view_employee_card' ? cardPermission.granted : true,
  }
})

vi.mock('@/lib/avatarImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/avatarImage')>()
  return { ...actual, loadAvatarObjectUrl: vi.fn(() => new Promise(() => {})) }
})

const { UserManagementPage } = await import('../UserManagementPage')

function employee(overrides: Partial<ApiUser> = {}): ApiUser {
  return {
    id: 1,
    username: 'okovalchuk',
    email: 'olena@test.com',
    first_name: 'Olena',
    last_name: 'Kovalchuk',
    full_name: 'Kovalchuk Olena',
    language: 'uk',
    timezone: 'Europe/Kyiv',
    status: 'active',
    must_change_password: false,
    failed_login_attempts: 0,
    created_at: '2026-01-01T00:00:00Z',
    is_agent: false,
    two_factor_enabled: false,
    two_factor_has_secret: false,
    work_format: 'office',
    projects: [
      {
        project_id: 1,
        project_name: 'Technofinance',
        role_id: 2,
        role_name: 'Lawyer',
        department_id: 3,
        department_name: 'Lawyers',
      },
    ],
    ...overrides,
  } as ApiUser
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('the employees table', () => {
  beforeEach(() => {
    localStorage.clear()
    rows.value = [employee()]
  })

  it('shows the columns in the agreed order', () => {
    renderPage()
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim())

    expect(headers).toEqual([
      'pages.users.tableHeaders.userId',
      'pages.users.tableHeaders.fullName',
      'pages.users.tableHeaders.department',
      'pages.users.tableHeaders.position',
      'pages.users.tableHeaders.status',
      'pages.users.tableHeaders.workFormat',
      'pages.users.tableHeaders.extension',
      'pages.users.tableHeaders.actions',
    ])
  })

  it('shows the id of each employee in the first cell', () => {
    rows.value = [employee({ id: 4242 })]
    renderPage()
    const firstRow = screen.getAllByRole('row')[1]
    const cells = within(firstRow).getAllByRole('cell')

    expect(cells[0]).toHaveTextContent('4242')
  })

  it('leaves the name where it was, one place to the right', () => {
    renderPage()
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim())

    expect(headers[0]).toBe('pages.users.tableHeaders.userId')
    expect(headers[1]).toBe('pages.users.tableHeaders.fullName')
    expect(headers.slice(1)).toEqual([
      'pages.users.tableHeaders.fullName',
      'pages.users.tableHeaders.department',
      'pages.users.tableHeaders.position',
      'pages.users.tableHeaders.status',
      'pages.users.tableHeaders.workFormat',
      'pages.users.tableHeaders.extension',
      'pages.users.tableHeaders.actions',
    ])
  })

  it('renders the department and position it was given', () => {
    renderPage()
    const row = screen.getByText('Olena Kovalchuk').closest('tr') as HTMLElement

    expect(within(row).getByText('Lawyers')).toBeInTheDocument()
    expect(within(row).getByText('Lawyer')).toBeInTheDocument()
  })

  it('shows an em dash when the role has no department', () => {
    rows.value = [
      employee({
        projects: [
          {
            project_id: 1,
            project_name: 'Technofinance',
            role_id: 2,
            role_name: 'Lawyer',
            department_id: null,
            department_name: null,
          },
        ],
      }),
    ]
    renderPage()
    const row = screen.getByText('Olena Kovalchuk').closest('tr') as HTMLElement

    expect(within(row).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('names the work format when it is known', () => {
    rows.value = [employee({ work_format: 'remote' })]
    renderPage()
    const row = screen.getByText('Olena Kovalchuk').closest('tr') as HTMLElement

    expect(within(row).getByText('Remote')).toBeInTheDocument()
  })

  it('does not call an unknown work format Office', () => {
    rows.value = [employee({ work_format: undefined })]
    renderPage()
    const row = screen.getByText('Olena Kovalchuk').closest('tr') as HTMLElement

    expect(within(row).queryByText('Office')).not.toBeInTheDocument()
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('puts a face beside the name', () => {
    renderPage()
    const row = screen.getByText('Olena Kovalchuk').closest('tr') as HTMLElement

    expect(within(row).getByText('OK')).toBeInTheDocument()
  })

  it('opens the card from the name rather than a view action', () => {
    renderPage()
    const row = screen.getByText('Olena Kovalchuk').closest('tr') as HTMLElement

    expect(within(row).getByRole('button', { name: /Olena Kovalchuk/ })).toBeInTheDocument()
    expect(
      within(row).queryByRole('button', { name: 'pages.users.actions.view' })
    ).not.toBeInTheDocument()
  })
})

describe('a reader who cannot open the employee card', () => {
  beforeEach(() => {
    cardPermission.granted = false
  })

  afterEach(() => {
    cardPermission.granted = true
  })

  it('still gets the details, in a modal rather than a dead name', async () => {
    rows.value = [employee()]
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /Olena Kovalchuk/ }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('opens the user detail view, not the employee card', async () => {
    rows.value = [employee()]
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /Olena Kovalchuk/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('pages.users.modals.view.title')).toBeInTheDocument()
  })
})

describe('the admin «unbind phones» action (#1532)', () => {
  beforeEach(() => {
    appLogin.available = true
  })

  afterEach(() => {
    appLogin.available = false
  })

  const REVOKE = { name: 'pages.users.actions.revokeAppLogin' }
  const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement

  it('is offered only for an employee the API reports with a bound phone', () => {
    rows.value = [
      employee({ id: 1, first_name: 'Olena', last_name: 'Kovalchuk', app_login_enabled: true }),
      employee({
        id: 2,
        username: 'ipetrenko',
        first_name: 'Ivan',
        last_name: 'Petrenko',
        full_name: 'Petrenko Ivan',
        app_login_enabled: false,
      }),
      employee({
        id: 3,
        username: 'mshevchenko',
        first_name: 'Maria',
        last_name: 'Shevchenko',
        full_name: 'Shevchenko Maria',
        app_login_enabled: undefined,
      }),
    ]
    renderPage()

    expect(within(rowOf('Olena Kovalchuk')).getByRole('button', REVOKE)).toBeInTheDocument()
    expect(within(rowOf('Ivan Petrenko')).queryByRole('button', REVOKE)).not.toBeInTheDocument()
    // An API that does not send the field says nothing about a phone: no action.
    expect(within(rowOf('Maria Shevchenko')).queryByRole('button', REVOKE)).not.toBeInTheDocument()
  })

  it('is not offered at all while the feature is off', () => {
    appLogin.available = false
    rows.value = [employee({ app_login_enabled: true })]
    renderPage()

    expect(within(rowOf('Olena Kovalchuk')).queryByRole('button', REVOKE)).not.toBeInTheDocument()
  })
})
