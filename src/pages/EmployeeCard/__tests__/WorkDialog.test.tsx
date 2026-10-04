import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeCard, ProjectAssignment } from '@/features/employeeCard/types.card'

const state = vi.hoisted(() => ({
  saved: vi.fn(),
  rejectWith: null as unknown,
  operatorsFor: undefined as number | null | undefined,
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
              // Deactivated: never offered to somebody who does not hold it.
              {
                id: 12,
                name: 'Retired post',
                department_id: 1,
                department_name: 'Collections',
                is_active: false,
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
  useOperators: (projectId: number | null | undefined) => {
    state.operatorsFor = projectId
    return {
      data: [
        { id: 7, full_name: 'Olena Kovalchuk', username: 'olena' },
        { id: 9, full_name: 'Serhiy Lytvyn', username: 'serhiy' },
      ],
    }
  },
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
// With one project ticked: its position, then its group; the manager comes last.
const roleSelect = () => screen.getAllByRole('combobox')[0]
const groupSelect = () => screen.getAllByRole('combobox')[1]
const removalDialog = () =>
  screen.getByRole('dialog', { name: 'pages.employeeCard.dialogs.removeProjectsTitle' })
const otherProjectBox = () =>
  screen.getByRole('checkbox', { name: 'pages.employeeCard.dialogs.otherProject' })

/** Tick a project and choose its position: the picker still "not assigned". */
async function addProject(name: string, position: string) {
  await userEvent.click(projectBox(name))
  const unassigned = screen
    .getAllByRole('combobox')
    .find((box) => box.textContent?.includes('pages.users.forms.notAssigned'))!
  await userEvent.click(unassigned)
  await userEvent.click(screen.getByRole('option', { name: position }))
}

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

  /*
   * The set replaces every membership, so it goes only when it was changed: a
   * save of something else must not touch the projects at all.
   */
  it('leaves the projects out when only something else was edited', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance({ group_id: 20 }), sidework] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    await userEvent.click(agentBox())
    await save()

    // Nothing was taken off, so nothing is asked.
    expect(
      screen.queryByText('pages.employeeCard.dialogs.removeProjectsTitle')
    ).not.toBeInTheDocument()
    const sent = state.saved.mock.calls[0][0]
    expect(sent).toEqual(expect.objectContaining({ is_agent: true }))
    expect(sent).not.toHaveProperty('project_assignments')
    expect(sent).not.toHaveProperty('role_id')
    expect(sent).not.toHaveProperty('project_id')
  })

  it('sends the whole set once any of it changes', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance({ group_id: 20 }), sidework] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    await userEvent.click(groupSelect())
    await userEvent.click(screen.getByRole('option', { name: 'Evening shift' }))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [
          { project_id: 3, role_id: 10, group_id: 21 },
          { project_id: 4, role_id: 30, group_id: null },
        ],
      })
    )
  })

  /*
   * One click on a checkbox, then a save for some other reason, would take
   * the person off a project and clear their position and group there - so
   * it is asked first.
   */
  it('asks before removing a project that is unticked, then removes it', async () => {
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

    expect(state.saved).not.toHaveBeenCalled()
    expect(removalDialog()).toHaveTextContent('pages.employeeCard.dialogs.removeProjectsMessage')

    await userEvent.click(
      within(removalDialog()).getByRole('button', {
        name: 'pages.employeeCard.dialogs.removeProjectsConfirm',
      })
    )

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [{ project_id: 3, role_id: 10, group_id: null }],
      })
    )
  })

  it('sends nothing when removing a project is called off', async () => {
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
    await userEvent.click(within(removalDialog()).getByRole('button', { name: /cancel/i }))

    expect(state.saved).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('dialog', { name: 'pages.employeeCard.dialogs.removeProjectsTitle' })
    ).not.toBeInTheDocument()
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

    await userEvent.click(groupSelect())
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
})

describe('WorkDialog: positions and groups', () => {
  beforeEach(() => {
    state.saved.mockReset()
    state.rejectWith = null
  })

  /*
   * A deactivated group is not in the active list, but it is still where the
   * person sits. Without it the field would open empty while the old id is
   * still what gets saved.
   */
  it('still opens on a group that is no longer offered, and keeps it', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance({ group_id: 99, group: 'Dormant shift' })] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(groupSelect()).toHaveTextContent('Dormant shift')

    // Saved with the set once the set changes: the kept group goes back as is.
    await addProject('Sidework', 'Sideline')
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [
          { project_id: 3, role_id: 10, group_id: 99 },
          { project_id: 4, role_id: 30, group_id: null },
        ],
      })
    )
  })

  it('still opens on a position that has been deactivated, with its groups', async () => {
    render(
      <WorkDialog
        card={card({
          assignments: [
            technofinance({
              role_id: 12,
              position: 'Retired post',
              group_id: 20,
              group: 'Morning shift',
            }),
          ],
        })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(roleSelect()).toHaveTextContent('Retired post (Collections)')
    expect(groupSelect()).toHaveTextContent('Morning shift')

    await addProject('Sidework', 'Sideline')
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [
          { project_id: 3, role_id: 12, group_id: 20 },
          { project_id: 4, role_id: 30, group_id: null },
        ],
      })
    )
  })

  it('never offers a deactivated position to somebody who does not hold it', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(roleSelect())

    expect(
      screen.getByRole('option', { name: 'Senior Operator (Collections)' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Retired post/ })).not.toBeInTheDocument()
  })

  it('sends "no group" as null, so it is removed rather than kept', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance({ group_id: 20, group: 'Morning shift' })] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    await userEvent.click(groupSelect())
    await userEvent.click(screen.getByRole('option', { name: 'pages.users.forms.noGroup' }))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [{ project_id: 3, role_id: 10, group_id: null }],
      })
    )
  })

  it('clears the group when the position changes under it', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance({ group_id: 20, group: 'Morning shift' })] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    await userEvent.click(roleSelect())
    await userEvent.click(screen.getByRole('option', { name: 'Senior Operator (Collections)' }))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [{ project_id: 3, role_id: 11, group_id: null }],
      })
    )
  })

  /*
   * A group never sits outside a department. An assignment that somehow
   * carries one without a department opens on no group rather than holding a
   * value behind a field it does not show.
   */
  it('sends no stale group for a position with no department', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [{ ...sidework, group_id: 20, group: 'Morning shift' }] })}
        projectId={4}
        open
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText(/pages\.users\.forms\.group/)).not.toBeInTheDocument()

    await addProject('Technofinance', 'Operator (Collections)')
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [
          { project_id: 4, role_id: 30, group_id: null },
          { project_id: 3, role_id: 10, group_id: null },
        ],
      })
    )
  })
})

/*
 * A project the reader may not see into comes with its ids but without its
 * names. It stays in the set, under a neutral name, and goes back as it came:
 * leaving it out would take the person off a project the reader never saw.
 */
describe('WorkDialog: a project the reader may not see into', () => {
  beforeEach(() => {
    state.saved.mockReset()
    state.rejectWith = null
  })

  const unseen: ProjectAssignment = {
    project_id: 9,
    project_name: null,
    role_id: 55,
    position: null,
    department_id: 6,
    department: null,
    group_id: 77,
    group: null,
  }

  it('shows it under a neutral name, ticked and locked, and sends it back as it came', async () => {
    render(
      <WorkDialog
        card={card({ assignments: [technofinance(), unseen] })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(otherProjectBox()).toBeChecked()
    expect(otherProjectBox()).toBeDisabled()

    await userEvent.click(roleSelect())
    await userEvent.click(screen.getByRole('option', { name: 'Senior Operator (Collections)' }))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({
        project_assignments: [
          { project_id: 3, role_id: 11, group_id: null },
          { project_id: 9, role_id: 55, group_id: 77 },
        ],
      })
    )
  })

  it('keeps it locked even when the reader can list the project, with no row to edit', async () => {
    render(
      <WorkDialog
        card={card({
          assignments: [technofinance(), { ...sidework, project_name: null, position: null }],
        })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByRole('checkbox', { name: 'Sidework' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sideline')).not.toBeInTheDocument()

    await userEvent.click(otherProjectBox())
    expect(otherProjectBox()).toBeChecked()

    await save()

    expect(
      screen.queryByText('pages.employeeCard.dialogs.removeProjectsTitle')
    ).not.toBeInTheDocument()
    expect(state.saved.mock.calls[0][0]).not.toHaveProperty('project_assignments')
  })
})

/*
 * A server older than the project list sends no `assignments` and ignores
 * `project_assignments`: it edits the one project the card shows, from the
 * single-project fields. Sending the list to it would report a save that
 * changed nothing.
 */
describe('WorkDialog: a server without the project list', () => {
  beforeEach(() => {
    state.saved.mockReset()
    state.rejectWith = null
  })

  it('offers only the project the card shows and sends it the old way', async () => {
    render(
      <WorkDialog card={card({ assignments: undefined })} projectId={3} open onClose={vi.fn()} />
    )

    expect(projectBox('Technofinance')).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Sidework' })).not.toBeInTheDocument()

    await userEvent.click(roleSelect())
    await userEvent.click(screen.getByRole('option', { name: 'Senior Operator (Collections)' }))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 3, role_id: 11, group_id: null })
    )
    expect(state.saved.mock.calls[0][0]).not.toHaveProperty('project_assignments')
  })

  it('leaves the project fields out when only something else was edited', async () => {
    render(
      <WorkDialog
        card={card({
          assignments: undefined,
          work: { ...card().work, group_id: 20, group: 'Morning shift' },
        })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(groupSelect()).toHaveTextContent('Morning shift')

    await userEvent.click(agentBox())
    await save()

    const sent = state.saved.mock.calls[0][0]
    expect(sent).toEqual(expect.objectContaining({ is_agent: true }))
    expect(sent).not.toHaveProperty('project_id')
    expect(sent).not.toHaveProperty('role_id')
    expect(sent).not.toHaveProperty('group_id')
    expect(sent).not.toHaveProperty('project_assignments')
  })

  it('starts on the shown project even without a position there, and asks for one', async () => {
    render(
      <WorkDialog
        card={card({
          assignments: undefined,
          work: {
            ...card().work,
            role_id: null,
            position: null,
            department_id: null,
            department: null,
          },
        })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(projectBox('Technofinance')).toBeChecked()

    await save()

    expect(state.saved).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'pages.users.forms.errors.assignRoleForEachProject'
    )

    await userEvent.click(roleSelect())
    await userEvent.click(screen.getByRole('option', { name: 'Operator (Collections)' }))
    await save()

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 3, role_id: 10, group_id: null })
    )
  })

  it('leaves projects out when the card shows none, and still saves the rest', async () => {
    render(
      <WorkDialog
        card={card({
          assignments: undefined,
          work: {
            ...card().work,
            project_id: null,
            project_name: null,
            role_id: null,
            position: null,
            department_id: null,
            department: null,
          },
        })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('pages.users.forms.assignProjects')).not.toBeInTheDocument()

    await userEvent.click(agentBox())
    await save()

    const sent = state.saved.mock.calls[0][0]
    expect(sent).toEqual(expect.objectContaining({ is_agent: true }))
    expect(sent).not.toHaveProperty('project_assignments')
    expect(sent).not.toHaveProperty('project_id')
    expect(sent).not.toHaveProperty('role_id')
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

  /*
   * The manager is somebody on the employee's own project - the one the card
   * shows - not on whichever project the reader happens to have active.
   */
  it("lists managers from the employee's project, the reader's only without one", () => {
    const { unmount } = render(<WorkDialog card={card()} projectId={5} open onClose={vi.fn()} />)
    expect(state.operatorsFor).toBe(3)
    unmount()

    render(
      <WorkDialog
        card={card({ work: { ...card().work, project_id: null, project_name: null } })}
        projectId={5}
        open
        onClose={vi.fn()}
      />
    )
    expect(state.operatorsFor).toBe(5)
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
