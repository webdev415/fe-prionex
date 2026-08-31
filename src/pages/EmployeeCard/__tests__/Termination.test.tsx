/**
 * Closing somebody's card when they leave, and reopening it if they come back.
 *
 * The rule the section exists to carry is that a closed card stops accepting
 * changes - everywhere, not only where the interface happens to hide a pencil.
 * The service refuses those writes with a 409 either way; what is tested here
 * is that the card stops offering them, and that the one section which must
 * stay editable does.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { EmployeeCard, Termination } from '@/features/employeeCard/types.card'

const api = vi.hoisted(() => ({
  recordTermination: vi.fn(),
  reinstate: vi.fn(),
}))

vi.mock('@/features/employeeCard/api/employeeCardApi', () => api)

vi.mock('@/lib/avatarImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/avatarImage')>()
  return { ...actual, loadAvatarObjectUrl: vi.fn(() => new Promise(() => {})) }
})

const { ProfilePanel } = await import('../components/ProfilePanel')
const { TerminationSection } = await import('../components/TerminationSection')
const { TerminationDialog } = await import('../components/dialogs/TerminationDialog')

const GONE: Termination = {
  terminated_on: '2025-04-30',
  reason: 'personal_desire',
  comment: 'Moved abroad',
}

function card(overrides: Partial<EmployeeCard> = {}): EmployeeCard {
  const built = {
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
      email: 'olena@prionex.com',
      position: null,
      department: null,
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
      project_id: null,
      project_name: null,
      department: null,
      department_id: null,
      position: null,
      role_id: null,
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
  } as EmployeeCard

  // Terminating deactivates the account now, so a fixture pairing a
  // termination with an active status is one the server cannot produce - and a
  // test resting on it would be testing a state that cannot happen.
  return {
    ...built,
    header: {
      ...built.header,
      status: built.termination ? 'inactive' : built.header.status,
    },
  }
}

function showSection(given: EmployeeCard = card()) {
  const onEdit = vi.fn()
  render(<TerminationSection card={given} onEdit={onEdit} />)
  return { onEdit }
}

function showDialog(given: EmployeeCard = card()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <TerminationDialog card={given} projectId={null} open onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose, invalidate }
}

/** Recording a departure. The submit is named for the act, not for saving. */
const terminate = () =>
  screen.getByRole('button', { name: 'pages.employeeCard.termination.terminate' })

/** Correcting one already recorded, which really is a save. */
const save = () => screen.getByRole('button', { name: 'actions.save' })

describe('TerminationSection', () => {
  it('says the employee is still working when nothing has been recorded', () => {
    showSection()

    expect(screen.getByText('pages.employeeCard.termination.stillHere')).toBeInTheDocument()
    expect(screen.queryByText('pages.employeeCard.termination.left')).toBeNull()
  })

  /*
   * An empty block invites the question of whether something failed to load.
   * Saying when it fills in answers it before it is asked.
   */
  it('says when the block will fill in', () => {
    showSection()

    expect(screen.getByText('pages.employeeCard.termination.fillsIn')).toBeInTheDocument()
  })

  /*
   * Nothing to click while nobody has left. Recording a departure is acted
   * from the profile panel, and a second control here would be a second place
   * to look for the same thing.
   */
  it('offers nothing to click while nobody has left', () => {
    showSection()

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows why and when somebody left', () => {
    showSection(card({ termination: GONE }))

    expect(screen.getByText('pages.employeeCard.termination.left')).toBeInTheDocument()
    expect(
      screen.getByText('pages.employeeCard.termination.reasons.personal_desire')
    ).toBeInTheDocument()
    expect(screen.getByText('Moved abroad')).toBeInTheDocument()
  })

  /*
   * The comment starts under the group label rather than under the values, so
   * a long one reads across the block instead of down a third of it.
   */
  it('gives the comment the whole width', () => {
    showSection(card({ termination: GONE }))

    const comment = screen.getByText('pages.employeeCard.termination.comment').parentElement
    expect(comment?.className).toContain('col-span-3')
  })

  it('says nothing was written where a comment was left out', () => {
    showSection(card({ termination: { ...GONE, comment: null } }))

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  /*
   * Every control on the card has gone by this point. Without a sentence
   * saying why, their absence reads as a permission problem - which is the
   * one thing it is not.
   */
  it('says the card is read-only rather than leaving it to be guessed', () => {
    showSection(card({ termination: GONE }))

    expect(screen.getByText('pages.employeeCard.termination.readOnly')).toBeInTheDocument()
  })

  /*
   * The exception to the freeze, and the reason it is an exception: a date
   * recorded wrongly has to be correctable, or the mistake is permanent.
   */
  it('keeps its own action after the card is closed', () => {
    showSection(card({ termination: GONE }))

    expect(
      screen.getByRole('button', { name: 'pages.employeeCard.termination.correct' })
    ).toBeInTheDocument()
  })

  it('offers nothing to somebody who may only read', () => {
    render(<TerminationSection card={card({ can_edit: false })} onEdit={vi.fn()} />)

    expect(
      screen.queryByRole('button', { name: 'pages.employeeCard.termination.record' })
    ).toBeNull()
  })
})

describe('TerminationDialog', () => {
  beforeEach(() => {
    api.recordTermination.mockReset().mockResolvedValue(card({ termination: GONE }))
    api.reinstate.mockReset().mockResolvedValue(card())
  })

  it('will not record a termination with no date', () => {
    showDialog()

    expect(terminate()).toBeDisabled()
  })

  /*
   * "Save" is what you press after changing a field. This closes somebody's
   * card and puts a departure in their history, and the submit is the last
   * chance to notice that is what is about to happen.
   */
  it('names the submit for what it does, not for saving', () => {
    showDialog()

    expect(terminate()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.save' })).toBeNull()
  })

  it('calls correcting one a save, because that is what it is', () => {
    showDialog(card({ termination: GONE }))

    expect(save()).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.employeeCard.termination.terminate' })
    ).toBeNull()
  })

  it('records the date and the reason against the employee whose card this is', async () => {
    showDialog()

    await userEvent.type(
      screen.getByPlaceholderText('pages.employeeCard.termination.date'),
      '30.04.2025'
    )
    await userEvent.click(terminate())

    await waitFor(() => expect(api.recordTermination).toHaveBeenCalled())
    expect(api.recordTermination.mock.calls[0][0]).toBe(7)
    expect(api.recordTermination.mock.calls[0][1]).toMatchObject({
      terminated_on: '2025-04-30',
      reason: 'personal_desire',
    })
  })

  it('opens on what was recorded, so a correction starts from it', () => {
    showDialog(card({ termination: GONE }))

    expect(screen.getByPlaceholderText('pages.employeeCard.termination.date')).toHaveValue(
      '30.04.2025'
    )
    expect(screen.getByLabelText('pages.employeeCard.termination.comment')).toHaveValue(
      'Moved abroad'
    )
  })

  /*
   * The departure is a line in the chronology, and the chronology is its own
   * query - it would otherwise keep the old ending until the page is reloaded,
   * which reads as the save having half worked.
   */
  it('refreshes the chronology once the departure is recorded', async () => {
    const { invalidate } = showDialog()

    await userEvent.type(
      screen.getByPlaceholderText('pages.employeeCard.termination.date'),
      '30.04.2025'
    )
    await userEvent.click(terminate())

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['employee-events'] }))
  })

  /*
   * It lived here once, below the fields, where nobody looking for it would
   * think to go - and a dialog whose submit reads "Terminate" is the wrong
   * place to keep the one control that undoes exactly that.
   */
  it('leaves reopening to the panel', () => {
    showDialog(card({ termination: GONE }))

    expect(
      screen.queryByRole('button', { name: 'pages.employeeCard.termination.reinstate' })
    ).toBeNull()
  })

  it('leaves the card alone when cancelled', async () => {
    const { onClose } = showDialog(card({ termination: GONE }))

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(api.recordTermination).not.toHaveBeenCalled()
    expect(api.reinstate).not.toHaveBeenCalled()
  })

  it('says what the server refused and keeps the dialog open', async () => {
    api.recordTermination.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'Insufficient permissions.' } },
    })
    const { onClose } = showDialog()

    await userEvent.type(
      screen.getByPlaceholderText('pages.employeeCard.termination.date'),
      '30.04.2025'
    )
    await userEvent.click(terminate())

    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient permissions')
    expect(onClose).not.toHaveBeenCalled()
  })
})

/*
 * Whether somebody still works here is a fact about the person, so it is acted
 * on where the person is - beside the name and the status badge, rather than
 * in a section at the end of the card that a reader has to find first.
 */
describe('the profile panel, on somebody who may be terminated', () => {
  const panel = (given: EmployeeCard, handlers: Record<string, () => void> = {}) => {
    const onTerminate = vi.fn()
    const onReinstate = vi.fn()
    render(
      <ProfilePanel
        header={given.header}
        terminated={given.termination !== null}
        canEdit={given.can_edit}
        onTerminate={onTerminate}
        onReinstate={onReinstate}
        {...handlers}
      />
    )
    return { onTerminate, onReinstate }
  }

  const terminateAction = () => screen.queryByRole('button', { name: /termination\.terminate/ })
  const reopenAction = () => screen.queryByRole('button', { name: /termination\.reinstate/ })

  it('offers to terminate somebody who is still working', async () => {
    const { onTerminate } = panel(card())

    await userEvent.click(terminateAction()!)

    expect(onTerminate).toHaveBeenCalled()
  })

  it('offers to reopen the card of somebody who has left', async () => {
    const { onReinstate } = panel(card({ termination: GONE }))

    await userEvent.click(reopenAction()!)

    expect(onReinstate).toHaveBeenCalled()
  })

  /*
   * The same fact from either side: an employee who has left can be brought
   * back, and one who has not cannot leave twice.
   */
  it('never offers both at once', () => {
    panel(card())
    expect(terminateAction()).toBeInTheDocument()
    expect(reopenAction()).toBeNull()
  })

  /*
   * The badge and the button now read the same fact. Somebody terminated is
   * deactivated by the act of terminating, so the panel cannot show a green
   * Active beside a card that says the employment ended.
   */
  it('shows the account as no longer active once somebody has left', () => {
    panel(card({ termination: GONE }))

    expect(screen.getByText('pages.employeeCard.status.inactive')).toBeInTheDocument()
    expect(screen.queryByText('pages.employeeCard.status.active')).toBeNull()
  })

  it('offers neither to somebody who may only read', () => {
    panel(card({ can_edit: false }))

    expect(terminateAction()).toBeNull()
    expect(reopenAction()).toBeNull()
  })
})
