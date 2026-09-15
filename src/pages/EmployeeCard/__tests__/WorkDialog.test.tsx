import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const state = vi.hoisted(() => ({
  saved: vi.fn(),
  rejectWith: null as unknown,
  groupQueries: [] as Array<{ filters: Record<string, unknown>; enabled: boolean }>,
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
        { id: 13, name: 'Admin', department_id: null, is_active: true },
      ],
    },
  }),
}))

/*
 * Answers the way the endpoint does: the groups of the department asked for,
 * and nothing at all while the query is switched off.
 */
vi.mock('@/features/groups', () => ({
  useGroups: (filters: Record<string, unknown>, enabled: boolean) => {
    state.groupQueries.push({ filters, enabled })
    const all = [
      { id: 20, name: 'Morning shift', department_id: 1 },
      { id: 21, name: 'Evening shift', department_id: 1 },
      { id: 22, name: 'Reports', department_id: 2 },
    ]
    return {
      data: enabled
        ? { groups: all.filter((group) => group.department_id === filters.department_id) }
        : undefined,
    }
  },
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

/** Somebody already in the morning shift. */
function grouped(): EmployeeCard {
  return card({ work: { ...card().work, group: 'Morning shift', group_id: 20 } })
}

/* Department, position, then group - the group select only exists with a department. */
const groupSelect = () => screen.getAllByRole('combobox')[2]

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
    state.groupQueries = []
  })

  it('offers only the positions that belong to the chosen department', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[1])

    expect(screen.getByRole('option', { name: 'Senior Operator' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Analyst' })).not.toBeInTheDocument()
  })

  /*
   * Most roles here belong to no department at all - Admin, collector,
   * manager, 25 of 39. Without an option that lists them, anybody holding one
   * is stranded: no department can be picked that shows their own position.
   */
  it('offers the department-less roles under "no department"', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(
      screen.getByRole('option', { name: 'pages.employeeCard.dialogs.noDepartment' })
    )
    await userEvent.click(screen.getAllByRole('combobox')[1])

    expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Operator' })).not.toBeInTheDocument()
  })

  /*
   * The server derives the department from the role and only reads this to
   * check the two agree, so sending it when nothing was chosen would be
   * sending a value it does not act on.
   */
  it('sends no department when none was chosen', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(
      screen.getByRole('option', { name: 'pages.employeeCard.dialogs.noDepartment' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    // The KEY must be absent, not merely null: expect.anything() does not
    // match null, so asserting on the value would pass even while a null the
    // server ignores was being sent.
    expect(Object.keys(state.saved.mock.calls[0][0])).not.toContain('department_id')
  })

  it('clears the position when the department changes under it', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(screen.getByRole('option', { name: 'Analytics' }))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(expect.not.objectContaining({ role_id: 10 }))
  })

  /*
   * The employees list has carried the Asterisk extension in a column all
   * along, while the card it links to showed neither number - the detail view
   * carrying less than the table above it.
   */
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

    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('sends the agent flag when it is turned on', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('checkbox'))
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

describe('WorkDialog: the group', () => {
  beforeEach(() => {
    state.saved.mockReset()
    state.rejectWith = null
    state.groupQueries = []
  })

  it('asks for the active groups of the chosen department', () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    expect(state.groupQueries.at(-1)).toEqual({
      filters: expect.objectContaining({ department_id: 1, is_active: true }),
      enabled: true,
    })
  })

  it('offers only the groups of the chosen department', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(groupSelect())

    expect(screen.getByRole('option', { name: 'Morning shift' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Evening shift' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Reports' })).not.toBeInTheDocument()
  })

  it('keeps leaving a group at the top of the list', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(groupSelect())

    expect(screen.getAllByRole('option')[0]).toHaveTextContent('pages.employeeCard.dialogs.noGroup')
  })

  it('opens on the group already recorded', () => {
    render(<WorkDialog card={grouped()} projectId={3} open onClose={vi.fn()} />)

    expect(groupSelect()).toHaveTextContent('Morning shift')
  })

  /*
   * A deactivated group is not in the active list, but it is still where the
   * person sits. Without it the field would open empty.
   */
  it('still opens on a group that is no longer offered', () => {
    render(
      <WorkDialog
        card={card({ work: { ...card().work, group: 'Dormant shift', group_id: 99 } })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(groupSelect()).toHaveTextContent('Dormant shift')
  })

  it('sends the group chosen', async () => {
    render(<WorkDialog card={grouped()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(groupSelect())
    await userEvent.click(screen.getByRole('option', { name: 'Evening shift' }))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(expect.objectContaining({ role_id: 10, group_id: 21 }))
  })

  /*
   * Every save sends the position, and the server compares position and
   * group as a pair - so the group has to travel with it or it is lost.
   */
  it('sends the group back unchanged when only something else was edited', async () => {
    render(<WorkDialog card={grouped()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(expect.objectContaining({ group_id: 20 }))
  })

  it('sends "no group" as null, so it is removed rather than kept', async () => {
    render(<WorkDialog card={grouped()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(groupSelect())
    await userEvent.click(
      screen.getByRole('option', { name: 'pages.employeeCard.dialogs.noGroup' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(expect.objectContaining({ group_id: null }))
  })

  it('clears the group when the department changes under it', async () => {
    render(<WorkDialog card={grouped()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(screen.getByRole('option', { name: 'Analytics' }))
    await userEvent.click(screen.getAllByRole('combobox')[1])
    await userEvent.click(screen.getByRole('option', { name: 'Analyst' }))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 12, group_id: null })
    )
  })

  it('offers no group without a department', async () => {
    render(<WorkDialog card={card()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(
      screen.getByRole('option', { name: 'pages.employeeCard.dialogs.noDepartment' })
    )

    expect(screen.queryByText('pages.employeeCard.fields.group')).not.toBeInTheDocument()
    expect(state.groupQueries.at(-1)?.enabled).toBe(false)
  })

  it('sends no group without a position to hold it', async () => {
    render(<WorkDialog card={grouped()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(screen.getByRole('option', { name: 'Analytics' }))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(Object.keys(state.saved.mock.calls[0][0])).not.toContain('group_id')
  })

  /*
   * A department change clears the position, and a group picked before a new
   * position is chosen would not be sent. So the field waits for one.
   */
  it('hides the group after a department change until a position is chosen', async () => {
    render(<WorkDialog card={grouped()} projectId={3} open onClose={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(screen.getByRole('option', { name: 'Analytics' }))

    expect(screen.queryByText('pages.employeeCard.fields.group')).not.toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('combobox')[1])
    await userEvent.click(screen.getByRole('option', { name: 'Analyst' }))

    expect(screen.getByText('pages.employeeCard.fields.group')).toBeInTheDocument()
    expect(groupSelect()).toHaveTextContent('pages.employeeCard.dialogs.noGroup')
  })

  /*
   * A group never sits outside a department. A card that somehow carries one
   * without a department opens on "no group" rather than holding a value
   * behind a field it does not show.
   */
  it('sends no stale group for a position with no department', async () => {
    render(
      <WorkDialog
        card={card({
          work: {
            ...card().work,
            department: null,
            department_id: null,
            position: 'Admin',
            role_id: 13,
            group: 'Morning shift',
            group_id: 20,
          },
        })}
        projectId={3}
        open
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('pages.employeeCard.fields.group')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 13, group_id: null })
    )
  })
})
