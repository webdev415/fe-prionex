import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

vi.mock('@/features/users/hooks/useUsers', () => ({
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
    full_name: 'Olena Kovalchuk',
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
