/**
 * Reviewing a project's holiday calendar (KAN-1107).
 *
 * The screen exists because the computed set can be wrong in ways only a
 * person catches, so what matters is that it never lets the three
 * empty-looking states blur together: no calendar, an empty calendar, and a
 * calendar that failed to load.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { HolidayCalendar } from '@/features/projects/types'

const getCalendar = vi.fn()
const generate = vi.fn()
const addDate = vi.fn()
const removeDate = vi.fn()
const confirmCal = vi.fn()
const toastWarning = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}))
vi.mock('@/features/projects/api/callingWindowApi', () => ({
  getHolidayCalendar: (...a: unknown[]) => getCalendar(...a),
  generateHolidayCalendar: (...a: unknown[]) => generate(...a),
  addHolidayDate: (...a: unknown[]) => addDate(...a),
  removeHolidayDate: (...a: unknown[]) => removeDate(...a),
  confirmHolidayCalendar: (...a: unknown[]) => confirmCal(...a),
  getCallingWindow: vi.fn(),
  setCallingWindow: vi.fn(),
  getHolidayCountries: vi.fn(),
  getSubdivisions: vi.fn(),
}))

import { HolidayCalendarPanel } from '../HolidayCalendarPanel'

const CALENDAR: HolidayCalendar = {
  year: new Date().getFullYear(),
  country: 'ES',
  subdivision: null,
  source_version: '0.104',
  reviewed: false,
  reviewed_at: null,
  reviewed_by: null,
  dates: [
    { holiday_date: '2026-01-01', name: "New Year's Day", origin: 'computed' },
    { holiday_date: '2026-05-30', name: 'Local feast', origin: 'manual' },
  ],
}

function renderPanel(country: string | null = 'ES') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <HolidayCalendarPanel projectId={7} country={country} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

const httpError = (status: number) => Object.assign(new Error('x'), { response: { status } })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HolidayCalendarPanel', () => {
  it('lists the calendar and marks which dates an admin added', async () => {
    getCalendar.mockResolvedValue(CALENDAR)
    renderPanel()
    expect(await screen.findByText('2026-01-01')).toBeInTheDocument()
    expect(screen.getByText('Local feast')).toBeInTheDocument()
    // The manual row is distinguishable — a regenerate keeps it, so an admin
    // needs to know which rows are theirs.
    expect(screen.getByText('pages.projects.holidayCalendar.added')).toBeInTheDocument()
  })

  it('offers to generate when no calendar exists, and says calls are refused meanwhile', async () => {
    getCalendar.mockRejectedValue(httpError(404))
    renderPanel()
    expect(
      await screen.findByText('pages.projects.holidayCalendar.notGenerated')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'pages.projects.holidayCalendar.generate' })
    ).toBeInTheDocument()
  })

  it('does not offer to generate when the calendar merely failed to load', async () => {
    // Generating over a calendar that exists would silently discard an
    // admin's corrections, so a 500 must not look like "nothing here yet".
    getCalendar.mockRejectedValue(httpError(500))
    renderPanel()
    expect(await screen.findByText('pages.projects.holidayCalendar.loadFailed')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.projects.holidayCalendar.generate' })
    ).toBeNull()
  })

  it('distinguishes an empty calendar from a missing one', async () => {
    getCalendar.mockResolvedValue({ ...CALENDAR, dates: [] })
    renderPanel()
    expect(
      await screen.findByText('pages.projects.holidayCalendar.emptyCalendar')
    ).toBeInTheDocument()
    expect(screen.queryByText('pages.projects.holidayCalendar.notGenerated')).toBeNull()
  })

  it('warns when a generate returns nothing at all', async () => {
    // Ukraine under martial law computes to zero. Correct, but indisting-
    // uishable from a failure unless it is called out.
    getCalendar.mockRejectedValue(httpError(404))
    generate.mockResolvedValue({ ...CALENDAR, dates: [] })
    renderPanel()
    fireEvent.click(
      await screen.findByRole('button', { name: 'pages.projects.holidayCalendar.generate' })
    )
    await waitFor(() => expect(toastWarning).toHaveBeenCalled())
  })

  it('requires the country before anything can be computed', async () => {
    getCalendar.mockRejectedValue(httpError(404))
    renderPanel(null)
    expect(await screen.findByText('pages.projects.holidayCalendar.noCountry')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.projects.holidayCalendar.generate' })
    ).toBeNull()
  })

  it('adds a date and removes one', async () => {
    getCalendar.mockResolvedValue(CALENDAR)
    addDate.mockResolvedValue(CALENDAR.dates[1])
    removeDate.mockResolvedValue(undefined)
    renderPanel()
    const input = await screen.findByLabelText('pages.projects.holidayCalendar.addDate')
    fireEvent.change(input, { target: { value: '2026-12-24' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.add' }))
    await waitFor(() => expect(addDate).toHaveBeenCalled())
    expect(addDate.mock.calls[0][2]).toBe('2026-12-24')

    fireEvent.click(screen.getByRole('button', { name: 'Delete 2026-01-01' }))
    await waitFor(() => expect(removeDate).toHaveBeenCalledWith(7, CALENDAR.year, '2026-01-01'))
  })

  it('refuses a malformed date rather than sending it', async () => {
    getCalendar.mockResolvedValue(CALENDAR)
    renderPanel()
    const input = await screen.findByLabelText('pages.projects.holidayCalendar.addDate')
    fireEvent.change(input, { target: { value: '24 Dec' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.add' }))
    expect(addDate).not.toHaveBeenCalled()
  })

  it('offers the review confirmation only while it is unreviewed', async () => {
    getCalendar.mockResolvedValue(CALENDAR)
    renderPanel()
    expect(
      await screen.findByRole('button', { name: 'pages.projects.holidayCalendar.confirm' })
    ).toBeInTheDocument()
  })
})
