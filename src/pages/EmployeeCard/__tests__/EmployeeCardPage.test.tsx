import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const state = vi.hoisted(() => ({
  card: null as EmployeeCard | null,
  isLoading: false,
  isError: false,
  askedFor: undefined as unknown,
  neighbours: undefined as unknown,
  neighboursQuery: undefined as unknown,
}))

vi.mock('@/features/employeeCard/hooks/useEmployeeCard', () => ({
  useEmployeeCard: (userId: number, projectId?: number | null) => {
    state.askedFor = { userId, projectId }
    return { data: state.card, isLoading: state.isLoading, isError: state.isError }
  },
  useCardNeighbours: (userId: number, listQuery: string) => {
    state.neighboursQuery = { userId, listQuery }
    return { data: state.neighbours }
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
      last_name: 'Kovalchuk',
      first_name: 'Olena',
      middle_name: null,
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
      telegram: '@olena',
      city: 'Kyiv',
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
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
    state.neighbours = undefined
    state.neighboursQuery = undefined
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

    const panel = screen.getByRole('complementary')
    expect(within(panel).getByRole('heading', { name: 'Olena Kovalchuk' })).toBeInTheDocument()
    expect(within(panel).getByText('Senior Operator')).toBeInTheDocument()
    expect(within(panel).getByText('Serhiy Lytvyn')).toBeInTheDocument()
  })

  it('shows the sections the card is made of', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(
      screen.getByRole('heading', { name: 'pages.employeeCard.sections.personal-information' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'pages.employeeCard.sections.work-information' })
    ).toBeInTheDocument()
    expect(screen.getByText('Kyiv')).toBeInTheDocument()
  })

  it('says a field is empty rather than leaving a gap', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getAllByText('pages.employeeCard.notFilledIn').length).toBeGreaterThan(0)
  })

  it('offers no edit action to somebody who may only read', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(
      screen.queryByRole('button', { name: 'pages.employeeCard.edit' })
    ).not.toBeInTheDocument()
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

describe('EmployeeCardPage navigation', () => {
  beforeEach(() => {
    state.card = card()
    state.isLoading = false
    state.isError = false
    state.neighbours = {
      position: 3,
      total: 247,
      previous_user_id: 6,
      next_user_id: 8,
    }
  })

  it('asks for the neighbours in the list the reader came from', () => {
    renderAt('/dashboard/team-management/users/7?project_id=3&status=active')

    expect(state.neighboursQuery).toEqual({
      userId: 7,
      listQuery: 'project_id=3&status=active',
    })
  })

  it('says where in the list this employee sits', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByText('pages.employeeCard.position')).toBeInTheDocument()
  })

  it('walks to either side without losing the filters', () => {
    renderAt('/dashboard/team-management/users/7?project_id=3')

    expect(
      screen.getByRole('link', { name: 'pages.employeeCard.previousEmployee' })
    ).toHaveAttribute('href', '/dashboard/team-management/users/6?project_id=3')
    expect(screen.getByRole('link', { name: 'pages.employeeCard.nextEmployee' })).toHaveAttribute(
      'href',
      '/dashboard/team-management/users/8?project_id=3'
    )
  })

  it('offers nothing to click at the end of the list', () => {
    state.neighbours = {
      position: 247,
      total: 247,
      previous_user_id: 6,
      next_user_id: null,
    }

    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByRole('button', { name: 'pages.employeeCard.nextEmployee' })).toBeDisabled()
  })

  it('shows no position for somebody the list does not contain', () => {
    state.neighbours = {
      position: null,
      total: 247,
      previous_user_id: null,
      next_user_id: null,
    }

    renderAt('/dashboard/team-management/users/7')

    expect(screen.queryByText('pages.employeeCard.position')).not.toBeInTheDocument()
  })
})
