import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeCard, ProjectAssignment } from '@/features/employeeCard/types.card'

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

vi.mock('@/features/projects', () => ({
  useProjects: () => ({
    data: {
      projects: [
        { id: 3, name: 'Technofinance' },
        { id: 4, name: 'Sidework' },
      ],
    },
  }),
}))

/* Each project has its own positions; a position carries its department. */
vi.mock('@/features/roles', () => ({
  useProjectRoles: (projectId: number) => ({
    data: {
      roles:
        projectId === 3
          ? [
              {
                id: 10,
                name: 'Operator',
                department_id: 1,
                department_name: 'Collections',
                is_active: true,
              },
              {
                id: 11,
                name: 'Senior Operator',
                department_id: 1,
                department_name: 'Collections',
                is_active: true,
              },
            ]
          : [{ id: 30, name: 'Sideline', department_id: null, is_active: true }],
    },
    error: null,
  }),
}))

vi.mock('@/features/groups', () => ({
  useGroups: (filters: Record<string, unknown>, enabled: boolean) => ({
    data: enabled
      ? {
          groups: [
            { id: 20, name: 'Morning shift', department_id: 1 },
            { id: 21, name: 'Evening shift', department_id: 1 },
          ].filter((group) => group.department_id === filters.department_id),
        }
      : undefined,
  }),
}))

vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({
    data: [
      { id: 7, full_name: 'Olena Kovalchuk', username: 'olena' },
      { id: 9, full_name: 'Serhiy Lytvyn', username: 'serhiy' },
    ],
  }),
}))

const { WorkDialog } = await import('../components/dialogs/WorkDialog')

function technofinance(overrides: Partial<ProjectAssignment> = {}): ProjectAssignment {
  return {
    project_id: 3,
    project_name: 'Technofinance',
    role_id: 10,
    position: 'Operator',
    department_id: 1,
    department: 'Collections',
    group_id: null,
    group: null,
    ...overrides,
  }
}

const sidework: ProjectAssignment = {
  project_id: 4,
  project_name: 'Sidework',
  role_id: 30,
  position: 'Sideline',
  department_id: null,
  department: null,
  group_id: null,
  group: null,
}

const projectBox = (name: string) => screen.getByRole('checkbox', { name })
const agentBox = () => screen.getByRole('checkbox', { name: 'pages.employeeCard.fields.isAgent' })
const save = () => userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

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
      group: null,
      group_id: null,
      position: 'Operator',
      role_id: 10,
      manager: null,
      hired_at: null,
      asterisk_extension: null,
      dialer_extension: null,
      is_agent: false,
    },
    assignments: [technofinance()],
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

describe('WorkDialog: projects', () => {
  beforeEach(() => {
    state.saved.mockReset()
    state.rejectWith = null
  })

  it('opens with every current project ticked and its position chosen', () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance(), sidework] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(projectBox('Technofinance')).toBeChecked()
    expect(projectBox('Sidework')).toBeChecked()
    expect(screen.getAllByText('Operator (Collections)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sideline').length).toBeGreaterThan(0)
  })

  it('sends the whole set unchanged when only something else was edited', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance({ group_id: 20 }), sidework] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [
          { project_id: 3, role_id: 10, group_id: 20 },
          { project_id: 4, role_id: 30, group_id: null },
        ],
      })
    )
    const sent = state.saved.mock.calls[0][0]
    expect(sent).not.toHaveProperty('role_id')
    expect(sent).not.toHaveProperty('project_id')
  })

  it('removes a project that is unticked', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance(), sidework] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    await userEvent.click(projectBox('Sidework'))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [{ project_id: 3, role_id: 10, group_id: null }],
      })
    )
  })

  it('adds a ticked project once it has a position', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(projectBox('Sidework'))
    await save()

    expect(state.saved).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'pages.users.forms.errors.assignRoleForEachProject'
    )

    // The new project's position picker is the one still showing "not assigned".
    const unassigned = screen
      .getAllByRole('combobox')
      .find((box) => box.textContent?.includes('pages.users.forms.notAssigned'))!
    await userEvent.click(unassigned)
    await userEvent.click(screen.getByRole('option', { name: 'Sideline' }))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [
          { project_id: 3, role_id: 10, group_id: null },
          { project_id: 4, role_id: 30, group_id: null },
        ],
      })
    )
  })

  it('refuses to leave the person without any project', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(projectBox('Technofinance'))
    await save()

    expect(state.saved).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'pages.users.forms.errors.selectAtLeastOneProject'
    )
  })

  it('sends the group chosen in a project', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    // Position, then group, for the one project; the manager picker comes last.
    await userEvent.click(screen.getAllByRole('combobox')[1])
    await userEvent.click(screen.getByRole('option', { name: 'Evening shift' }))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [{ project_id: 3, role_id: 10, group_id: 21 }],
      })
    )
  })

  it('keeps a current project the reader cannot list', () => {
    render(
      <WorkDialog
        card={card({
          assignments: [
            technofinance(),
            { ...sidework, project_id: 9, project_name: 'Hidden project' },
          ],
        })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(projectBox('Hidden project')).toBeChecked()
  })

  it('falls back to the shown project when the server sends no list', async () => {
    render(
      <WorkDialog card={card({ assignments: undefined })} projectId={3} open onClose={vi.fn()} />
    )

    expect(projectBox('Technofinance')).toBeChecked()
    await save()
    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [{ project_id: 3, role_id: 10, group_id: null }],
      })
    )
  })
})

describe('WorkDialog: the rest of the section', () => {
  beforeEach(() => {
    state.saved.mockReset()
    state.rejectWith = null
  })

  it('opens on the extensions already recorded', () => {
    render(
      <WorkDialog
        card={card({
          work: {
            ...card().work,
            asterisk_extension: '1004',
            dialer_extension: '9001',
          },
        })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText('pages.employeeCard.fields.asteriskExtension')).toHaveValue('1004')
    expect(screen.getByLabelText('pages.employeeCard.fields.dialerExtension')).toHaveValue('9001')
  })

  it('sends an emptied extension as null, so it is removed rather than kept', async () => {
    render(
      <WorkDialog
        card={card({ work: { ...card().work, asterisk_extension: '1004' } })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    await userEvent.clear(screen.getByLabelText('pages.employeeCard.fields.asteriskExtension'))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(expect.objectContaining({ asterisk_extension: null }))
  })

  /*
   * The flag sits with the extension it gates: an agent with no dialer
   * extension is not provisioned, and an extension on somebody who is not an
   * agent is not either.
   */
  it('opens on whether they take dialer calls', () => {
    render(
      <WorkDialog
        card={card({ work: { ...card().work, is_agent: true } })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(agentBox()).toBeChecked()
  })

  it('sends the agent flag when it is turned on', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(agentBox())
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(expect.objectContaining({ is_agent: true }))
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
