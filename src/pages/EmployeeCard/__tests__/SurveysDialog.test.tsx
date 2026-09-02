/**
 * Recording the surveys somebody answered.
 *
 * Surveys run outside Prionex, and 84% of employees here are recorded under
 * personal addresses across five providers - so an export cannot be attributed
 * to people by matching what it carries. Whoever enters the answer supplies
 * that judgement, which is why this is a form on one person's card rather than
 * a file covering many.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const api = vi.hoisted(() => ({
  addSurvey: vi.fn(),
  updateSurvey: vi.fn(),
  removeSurvey: vi.fn(),
}))

vi.mock('@/features/employeeCard/api/employeeCardApi', () => api)

const { SurveysDialog } = await import('../components/dialogs/SurveysDialog')

const SURVEY = {
  id: 11,
  name: 'Q2 2024 Satisfaction',
  completed_on: '2024-06-15',
  status: 'completed',
  score: 87,
  max_score: 100,
  details_url: null,
}

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
      asterisk_extension: null,
      dialer_extension: null,
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
}

function show(given: EmployeeCard = card(), surveyId: number | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <SurveysDialog card={given} projectId={null} surveyId={surveyId} open onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose, invalidate }
}

const field = (key: string) => screen.getByLabelText(`pages.employeeCard.surveys.${key}`)
const add = () => screen.getByRole('button', { name: 'pages.employeeCard.surveys.add' })

describe('SurveysDialog', () => {
  /*
   * Cancel and save, where every other dialog on this card ends. The submit
   * lives in the footer rather than among the fields, so `form` is what keeps
   * it a submit for the fields it commits.
   */
  it('ends with cancel beside the save, not a close on its own', () => {
    show()

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const save = screen.getByRole('button', { name: 'pages.employeeCard.surveys.add' })

    expect(cancel).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(save).toHaveAttribute('type', 'submit')
    expect(save).toHaveAttribute('form', 'employee-card-survey')
  })

  it('leaves the dialog without saving when cancelled', async () => {
    const { onClose } = show()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(api.addSurvey).not.toHaveBeenCalled()
  })

  beforeEach(() => {
    api.addSurvey.mockReset().mockResolvedValue(card())
    api.updateSurvey.mockReset().mockResolvedValue(card())
    api.removeSurvey.mockReset().mockResolvedValue(card())
  })

  it('will not add a survey with no name', () => {
    show()

    expect(add()).toBeDisabled()
  })

  /*
   * The employee is the card's, not something typed in or matched from a file.
   * That is the whole point of recording it here.
   */
  it('records the answer against the employee whose card this is', async () => {
    show()

    await userEvent.type(field('name'), 'Q2 2024 Satisfaction')
    await userEvent.click(add())

    await waitFor(() => expect(api.addSurvey).toHaveBeenCalled())
    expect(api.addSurvey.mock.calls[0][0]).toBe(7)
  })

  it('sends the score', async () => {
    show()

    await userEvent.type(field('name'), 'Q2 2024 Satisfaction')
    await userEvent.type(field('score'), '87')
    await userEvent.click(add())

    await waitFor(() => expect(api.addSurvey).toHaveBeenCalled())
    expect(api.addSurvey.mock.calls[0][1]).toMatchObject({ score: 87 })
  })

  /*
   * Not asked for, but not invented either. The field is bounded by 100, so a
   * score entered here is out of 100 as a matter of fact - which is what makes
   * storing it honest rather than a guess.
   */
  it('bounds the score and records what it is out of', async () => {
    show()

    expect(screen.queryByLabelText(/surveys.maxScore/)).toBeNull()
    expect(field('score')).toHaveAttribute('min', '0')
    expect(field('score')).toHaveAttribute('max', '100')

    await userEvent.type(field('name'), 'Q2 2024 Satisfaction')
    await userEvent.type(field('score'), '87')
    await userEvent.click(add())

    await waitFor(() => expect(api.addSurvey).toHaveBeenCalled())
    expect(api.addSurvey.mock.calls[0][1]).toMatchObject({ score: 87, max_score: 100 })
  })

  it('records no total for an answer still being waited on', async () => {
    show()

    await userEvent.type(field('name'), 'Manager Evaluation Q3')
    await userEvent.click(add())

    await waitFor(() => expect(api.addSurvey).toHaveBeenCalled())
    expect(api.addSurvey.mock.calls[0][1]).toMatchObject({ score: null, max_score: null })
  })

  /*
   * A result with a score is one that came back. Asking a second question
   * about it would be asking somebody to say the same thing twice.
   */
  it('treats an answer with no score as still being waited on', async () => {
    show()

    await userEvent.type(field('name'), 'Manager Evaluation Q3')
    await userEvent.click(add())

    await waitFor(() => expect(api.addSurvey).toHaveBeenCalled())
    expect(api.addSurvey.mock.calls[0][1]).toMatchObject({ status: 'pending', score: null })
  })

  /*
   * One dialog for both jobs: opened on a survey it corrects that one, opened
   * on nothing it records a new one. Adding and correcting ask for exactly the
   * same six things.
   */
  it('corrects the survey it was opened on rather than adding another', async () => {
    show(card({ surveys: [SURVEY] as never }), 11)

    await userEvent.click(screen.getByRole('button', { name: 'pages.employeeCard.surveys.save' }))

    await waitFor(() => expect(api.updateSurvey).toHaveBeenCalled())
    expect(api.updateSurvey.mock.calls[0][1]).toBe(11)
    expect(api.addSurvey).not.toHaveBeenCalled()
  })

  it('opens filled with what it is correcting', () => {
    show(card({ surveys: [SURVEY] as never }), 11)

    expect(field('name')).toHaveValue('Q2 2024 Satisfaction')
    expect(field('score')).toHaveValue(87)
  })

  it('opens empty when it is recording a new one', () => {
    show(card({ surveys: [SURVEY] as never }), null)

    expect(field('name')).toHaveValue('')
  })

  /*
   * A dated answer puts a line in the chronology, and the chronology is its
   * own query - the card coming back does not refresh it. Without this the
   * section below says nothing happened until the page is reloaded, which
   * reads as the save having half worked.
   */
  it('refreshes the chronology the answer just appeared in', async () => {
    const { invalidate } = show()

    await userEvent.type(field('name'), 'Q2 2024 Satisfaction')
    await userEvent.click(add())

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['employee-events'] }))
  })

  /*
   * An answer with no date gets no chronology line - the timeline places
   * things by date and will not invent one. Said beside the empty field
   * rather than in the note at the top: by the time it has been saved, the
   * line is missing from a history nobody thinks to check.
   */
  it('says what a missing date costs, while the date is missing', async () => {
    show()

    expect(screen.getByText('pages.employeeCard.surveys.noDateHint')).toBeInTheDocument()

    await userEvent.type(
      screen.getByPlaceholderText('pages.employeeCard.surveys.completedOn'),
      '15.06.2024'
    )

    expect(screen.queryByText('pages.employeeCard.surveys.noDateHint')).toBeNull()
  })

  it('says nothing about it when correcting an answer that has a date', () => {
    show(card({ surveys: [SURVEY] as never }), 11)

    expect(screen.queryByText('pages.employeeCard.surveys.noDateHint')).toBeNull()
  })

  it('closes once the answer is saved', async () => {
    const { onClose } = show()

    await userEvent.type(field('name'), 'Q2 2024 Satisfaction')
    await userEvent.click(add())

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('says what the server refused and keeps the form filled', async () => {
    api.addSurvey.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'Insufficient permissions.' } },
    })
    show()

    await userEvent.type(field('name'), 'Q2 2024 Satisfaction')
    await userEvent.click(add())

    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient permissions')
    expect(field('name')).toHaveValue('Q2 2024 Satisfaction')
  })
})
