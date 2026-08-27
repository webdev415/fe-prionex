import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const state = vi.hoisted(() => ({
  card: null as EmployeeCard | null,
  isLoading: false,
  isError: false,
  askedFor: undefined as unknown,
}))

vi.mock('@/features/employeeCard/hooks/useEmployeeCard', () => ({
  useEmployeeCard: (userId: number, projectId?: number | null) => {
    state.askedFor = { userId, projectId }
    return { data: state.card, isLoading: state.isLoading, isError: state.isError }
  },
}))

vi.mock('@/features/employeeCard', () => ({
  ChronologySection: ({ userId }: { userId: number }) => (
    <div data-testid="chronology">chronology for {userId}</div>
  ),
}))

vi.mock('@/lib/avatarImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/avatarImage')>()
  return { ...actual, loadAvatarObjectUrl: vi.fn(() => new Promise(() => {})) }
})

const { EmployeeCardPage } = await import('../EmployeeCardPage')

function card(overrides: Partial<EmployeeCard> = {}): EmployeeCard {
  return {
    header: {
      id: 7,
      full_name: 'Olena Kovalchuk',
      status: 'active',
      work_format: 'remote',
      avatar_url: null,
      phone: '+380 67 123 45 67',
      email: 'olena@prionex.com',
      position: 'Senior Operator',
      department: 'Collection Department',
      manager: 'Serhiy Lytvyn',
      manager_user_id: 9,
      hired_at: '2024-03-15',
      telegram: '@olena',
    },
    personal: {
      date_of_birth: null,
      gender: null,
      citizenship: null,
      telegram: '@olena',
      city: 'Kyiv',
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
      tax_id: null,
      passport: null,
    },
    work: {
      project_id: 3,
      project_name: 'Technofinance',
      department: 'Collection Department',
      department_id: 1,
      position: 'Senior Operator',
      role_id: 2,
      manager: 'Serhiy Lytvyn',
      hired_at: '2024-03-15',
    },
    contacts: [],
    children: [],
    additional: { military_status: null, visa_status: null, educations: [], languages: [] },
    documents: [],
    surveys: [],
    interview_comment: null,
    can_edit: false,
    ...overrides,
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/team-management/users/:userId" element={<EmployeeCardPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EmployeeCardPage', () => {
  beforeEach(() => {
    state.card = card()
    state.isLoading = false
    state.isError = false
    state.askedFor = undefined
  })

  it('reads the employee from the address', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(state.askedFor).toEqual({ userId: 7, projectId: null })
  })

  it('carries the project the list was filtered by', () => {
    renderAt('/dashboard/team-management/users/7?project_id=3&status=active')

    expect(state.askedFor).toEqual({ userId: 7, projectId: 3 })
  })

  it('sends the reader back to the list they came from', () => {
    renderAt('/dashboard/team-management/users/7?project_id=3&status=active')

    const back = screen.getByRole('link', { name: 'pages.employeeCard.backToList' })
    expect(back).toHaveAttribute(
      'href',
      '/dashboard/team-management/users?project_id=3&status=active'
    )
  })

  it('shows whose card this is', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByRole('heading', { name: 'Olena Kovalchuk' })).toBeInTheDocument()
    expect(screen.getByText('Senior Operator')).toBeInTheDocument()
    expect(screen.getByText('Serhiy Lytvyn')).toBeInTheDocument()
  })

  it('offers a tab for every section', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getAllByRole('tab')).toHaveLength(7)
  })

  it('mounts the chronology for this employee', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByTestId('chronology')).toHaveTextContent('chronology for 7')
  })

  it('offers a way to write to them and to open Telegram', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(
      screen.getByRole('link', { name: 'pages.employeeCard.panel.writeEmail' })
    ).toHaveAttribute('href', 'mailto:olena@prionex.com')
    expect(
      screen.getByRole('link', { name: 'pages.employeeCard.panel.openTelegram' })
    ).toHaveAttribute('href', 'https://t.me/olena')
  })

  it('leaves out a quick action it has no address for', () => {
    state.card = card({
      header: { ...card().header, telegram: null, email: null },
    })

    renderAt('/dashboard/team-management/users/7')

    expect(
      screen.queryByRole('link', { name: 'pages.employeeCard.panel.openTelegram' })
    ).not.toBeInTheDocument()
  })

  it('reports a failure instead of an empty card', () => {
    state.card = null
    state.isError = true

    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByRole('alert')).toHaveTextContent('pages.employeeCard.failed')
  })

  it('refuses an address that is not an employee id', () => {
    renderAt('/dashboard/team-management/users/not-a-number')

    expect(screen.getByText('pages.employeeCard.notFound')).toBeInTheDocument()
  })
})
