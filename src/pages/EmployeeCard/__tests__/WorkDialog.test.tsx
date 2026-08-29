import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const state = vi.hoisted(() => ({
  saved: vi.fn(),
  rejectWith: null as unknown,
}))

vi.mock('@/features/employeeCard/hooks/useEmployeeCard', () => ({
  useUpdateWork: () => ({
    mutateAsync: async (changes: unknown) => {
      if (state.rejectWith) throw state.rejectWith
      state.saved(changes)
      return {} as EmployeeCard
    },
    isPending: false,
  }),
}))

vi.mock('@/features/departments', () => ({
  useDepartments: () => ({
    data: {
      departments: [
        { id: 1, name: 'Collections' },
        { id: 2, name: 'Analytics' },
      ],
    },
  }),
}))

vi.mock('@/features/roles', () => ({
  useRoles: () => ({
    data: {
      roles: [
        { id: 10, name: 'Operator', department_id: 1, is_active: true },
        { id: 11, name: 'Senior Operator', department_id: 1, is_active: true },
        { id: 12, name: 'Analyst', department_id: 2, is_active: true },
      ],
    },
  }),
}))

vi.mock('@/features/users/hooks/useUsers', () => ({
  useUsers: () => ({
    data: {
      users: [
        { id: 7, full_name: 'Olena Kovalchuk', username: 'olena' },
        { id: 9, full_name: 'Serhiy Lytvyn', username: 'serhiy' },
      ],
    },
  }),
}))

const { WorkDialog } = await import('../components/dialogs/WorkDialog')

function card(overrides: Partial<EmployeeCard> = {}): EmployeeCard {
  return {
    header: {
      id: 7,
      full_name: 'Kovalchuk Olena',
      last_name: 'Kovalchuk',
      first_name: 'Olena',
      middle_name: null,
      status: 'active',
      work_format: null,
      avatar_url: null,
      phone: null,
      email: null,
      position: 'Operator',
      department: 'Collections',
      manager: null,
      manager_user_id: null,
      hired_at: null,
      telegram: null,
    },
    personal: {
      date_of_birth: null,
      telegram: null,
      city: null,
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
    },
    work: {
      project_id: 3,
      project_name: 'Technofinance',
      department: 'Collections',
      department_id: 1,
      position: 'Operator',
      role_id: 10,
      manager: null,
      hired_at: null,
    },
    contacts: [],
    children: [],
    additional: { military_status: null, visa_status: null, educations: [], languages: [] },
    documents: [],
    surveys: [],
    interview_comment: null,
    termination: null,
    can_edit: true,
    ...overrides,
  }
}

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

describe('WorkDialog', () => {
  beforeEach(() => {
    state.saved.mockReset()
    state.rejectWith = null
  })

  it('offers only the positions that belong to the chosen department', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[1])

    expect(screen.getByRole('option', { name: 'Senior Operator' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Analyst' })).not.toBeInTheDocument()
  })

  it('clears the position when the department changes under it', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(screen.getByRole('option', { name: 'Analytics' }))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(expect.not.objectContaining({ role_id: 10 }))
  })

  it('never offers somebody as their own manager', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('pages.employeeCard.fields.manager'))

    expect(screen.getByRole('option', { name: 'Serhiy Lytvyn' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Olena Kovalchuk' })).not.toBeInTheDocument()
  })

  /*
   * Every employee is on this list, which is not something anybody can pick
   * from by scrolling - it means knowing where in the order a name falls.
   * Department and position stay plain: those are short lists you can read.
   */
  it('lets a manager be found by typing rather than only by scrolling', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('pages.employeeCard.fields.manager'))
    const search = screen.getByPlaceholderText('pages.employeeCard.dialogs.searchManager')
    await userEvent.type(search, 'Serhiy')

    expect(screen.getByRole('option', { name: 'Serhiy Lytvyn' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /noManager/ })).not.toBeInTheDocument()
  })

  it('keeps removing a manager at the top rather than buried among the names', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('pages.employeeCard.fields.manager'))

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveTextContent('pages.employeeCard.dialogs.noManager')
  })

  it('sends the project so the right assignment is the one that changes', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 3, role_id: 10 })
    )
  })

  it('clears the manager when nobody is chosen', async () => {
    render(
      <WorkDialog
        card={card({ header: { ...card().header, manager_user_id: 9 } })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    await userEvent.click(screen.getByLabelText('pages.employeeCard.fields.manager'))
    await userEvent.click(
      screen.getByRole('option', { name: 'pages.employeeCard.dialogs.noManager' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(expect.objectContaining({ manager_user_id: null }))
  })

  it('shows what the server said when it refuses the pair', async () => {
    state.rejectWith = {
      response: { data: { detail: 'That position belongs to a different department' } },
    }
    const onClose = vi.fn()
    render(<WorkDialog card={card()} projectId={3} open onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('different department')
    expect(onClose).not.toHaveBeenCalled()
  })
})
