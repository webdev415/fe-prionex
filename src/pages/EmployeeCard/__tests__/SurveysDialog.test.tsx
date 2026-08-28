/**
 * Loading an export of survey answers.
 *
 * The refusals are the point of this screen. The server returns every rejected
 * row with its line number so a file can be corrected, and a dialog reporting
 * only "5 loaded" would throw away the half that makes a bad file fixable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const importSurveys = vi.hoisted(() => vi.fn())

vi.mock('@/features/employeeCard/api/employeeCardApi', () => ({ importSurveys }))

const { SurveysDialog } = await import('../components/dialogs/SurveysDialog')

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <SurveysDialog open onClose={vi.fn()} />
    </QueryClientProvider>
  )
  return { invalidate }
}

const csv = () =>
  new File(['Timestamp,Email Address\n6/15/2024,a@b.com\n'], 'answers.csv', { type: 'text/csv' })

const picker = () => screen.getByLabelText('pages.employeeCard.surveys.file')
const runIt = () =>
  userEvent.click(screen.getByRole('button', { name: 'pages.employeeCard.surveys.import' }))

describe('SurveysDialog', () => {
  beforeEach(() => {
    importSurveys.mockReset().mockResolvedValue({ created: 5, updated: 0, refused: 0, rows: [] })
  })

  it('will not import until a file has been chosen', () => {
    show()

    expect(screen.getByRole('button', { name: 'pages.employeeCard.surveys.import' })).toBeDisabled()
  })

  it('sends the file and the name it was given', async () => {
    show()

    await userEvent.upload(picker(), csv())
    await userEvent.type(screen.getByLabelText(/surveys.name/), 'Q2 2024 Satisfaction')
    await runIt()

    await waitFor(() => expect(importSurveys).toHaveBeenCalled())
    expect(importSurveys.mock.calls[0][1]).toBe('Q2 2024 Satisfaction')
  })

  it('says what was loaded', async () => {
    show()

    await userEvent.upload(picker(), csv())
    await runIt()

    expect(await screen.findByText(/surveys.loaded/)).toBeInTheDocument()
  })

  /*
   * The reason the endpoint returns the rows at all. Without them somebody has
   * to guess which of several thousand rows went missing.
   */
  it('lists every row it would not load, with its line number', async () => {
    importSurveys.mockResolvedValue({
      created: 1,
      updated: 0,
      refused: 2,
      rows: [
        { row: 4, email: 'ghost@nowhere.com', reason: 'no employee with that email' },
        { row: 9, email: null, reason: 'missing email or survey name' },
      ],
    })
    show()

    await userEvent.upload(picker(), csv())
    await runIt()

    expect(await screen.findByText(/no employee with that email/)).toBeInTheDocument()
    expect(screen.getByText(/missing email or survey name/)).toBeInTheDocument()
    expect(screen.getAllByText(/surveys.line/)).toHaveLength(2)
  })

  /*
   * One file covers whoever is in it, so every card can have changed - not
   * only the one that happens to be open behind this dialog.
   */
  it('drops every cached card, not just the open one', async () => {
    const { invalidate } = show()

    await userEvent.upload(picker(), csv())
    await runIt()

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['employee-card'] }))
  })

  it('says what the server refused and keeps the dialog open', async () => {
    importSurveys.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'The export needs a column for email.' } },
    })
    show()

    await userEvent.upload(picker(), csv())
    await runIt()

    expect(await screen.findByRole('alert')).toHaveTextContent('column for email')
  })

  /*
   * A rejected body comes back with `detail` as a list of validation objects.
   * Reading only the string case turned every one of those into a message that
   * said nothing about what to fix - which is what a bad Content-Type looked
   * like from the outside.
   */
  it('says something useful when the body itself was refused', async () => {
    importSurveys.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          detail: [{ type: 'missing', loc: ['body', 'file'], msg: 'Field required' }],
        },
      },
    })
    show()

    await userEvent.upload(picker(), csv())
    await runIt()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toBe('pages.employeeCard.saveFailed')
    expect(alert).toHaveTextContent(/required/i)
  })
})
