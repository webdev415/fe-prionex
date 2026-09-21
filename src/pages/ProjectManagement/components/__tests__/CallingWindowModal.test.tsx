/**
 * Configuring a project's calling window (KAN-1107).
 *
 * The cases worth pinning are the ones where the form and the API disagree
 * about what a value means — an empty weekday selection above all, which the
 * form shows as "every day" and the API rejects as "no day".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CallingWindowConfig } from '@/features/projects/types'

const setWindow = vi.fn()
const getWindow = vi.fn()

interface SelectOption {
  id: string
  name: string
}
const { selectOptions } = vi.hoisted(() => ({
  selectOptions: {} as Record<string, SelectOption[]>,
}))
// The dropdown's own rendering is not what this file is pinning — what the
// modal hands it is. Recording the props keeps the assertion off
// SearchableSelect's internals, which an unrelated change to it could break.
vi.mock('@/components/ui/SearchableSelect', () => ({
  SearchableSelect: ({
    options,
    placeholder,
  }: {
    options: SelectOption[]
    placeholder?: string
  }) => {
    selectOptions[placeholder ?? ''] = options
    return null
  },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/features/projects/api/callingWindowApi', () => ({
  getCallingWindow: (...a: unknown[]) => getWindow(...a),
  setCallingWindow: (...a: unknown[]) => setWindow(...a),
  getHolidayCountries: () => Promise.resolve([{ code: 'ES', name: 'Spain' }]),
  getSubdivisions: () => Promise.resolve(['CN']),
  getHolidayCalendar: vi.fn(),
  generateHolidayCalendar: vi.fn(),
  addHolidayDate: vi.fn(),
  removeHolidayDate: vi.fn(),
  confirmHolidayCalendar: vi.fn(),
}))

import { CallingWindowModal } from '../CallingWindowModal'

const SPAIN: CallingWindowConfig = {
  enabled: true,
  start: '09:00',
  end: '20:45',
  weekdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Madrid',
  holiday_country: 'ES',
  holiday_subdivision: null,
}

function renderModal(config: CallingWindowConfig = SPAIN) {
  getWindow.mockResolvedValue(config)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CallingWindowModal projectId={7} projectName="SolventaPro" open onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

const saveButton = () => screen.getByRole('button', { name: /actions\.save|Save/i })

beforeEach(() => {
  vi.clearAllMocks()
  setWindow.mockResolvedValue(SPAIN)
})

describe('CallingWindowModal', () => {
  it('loads the existing window into the form', async () => {
    renderModal()
    expect(await screen.findByDisplayValue('09:00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20:45')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Europe/Madrid')).toBeInTheDocument()
  })

  it('saves the window as configured', async () => {
    renderModal()
    await screen.findByDisplayValue('09:00')
    fireEvent.click(saveButton())
    await waitFor(() => expect(setWindow).toHaveBeenCalled())
    expect(setWindow.mock.calls[0][1]).toMatchObject({
      enabled: true,
      start: '09:00',
      end: '20:45',
      weekdays: [1, 2, 3, 4, 5],
      timezone: 'Europe/Madrid',
    })
  })

  it('sends null rather than [] when no weekday is selected', async () => {
    // The form shows an empty selection as "every day"; the API rejects [] as
    // a window callable on no day. Sending [] straight through would turn a
    // reasonable UI state into a 422.
    renderModal({ ...SPAIN, weekdays: [] })
    await screen.findByDisplayValue('09:00')
    fireEvent.click(saveButton())
    await waitFor(() => expect(setWindow).toHaveBeenCalled())
    expect(setWindow.mock.calls[0][1].weekdays).toBeNull()
  })

  it('refuses to save a malformed time', async () => {
    renderModal()
    const start = await screen.findByDisplayValue('09:00')
    fireEvent.change(start, { target: { value: '9am' } })
    await waitFor(() => expect(saveButton()).toBeDisabled())
    fireEvent.click(saveButton())
    expect(setWindow).not.toHaveBeenCalled()
  })

  it('refuses an enabled window with no timezone', async () => {
    renderModal()
    const tz = await screen.findByDisplayValue('Europe/Madrid')
    fireEvent.change(tz, { target: { value: '  ' } })
    await waitFor(() => expect(saveButton()).toBeDisabled())
  })

  it('refuses a window whose start equals its end', async () => {
    renderModal()
    const end = await screen.findByDisplayValue('20:45')
    fireEvent.change(end, { target: { value: '09:00' } })
    await waitFor(() => expect(saveButton()).toBeDisabled())
  })

  it('clears the bounds when the window is switched off', async () => {
    renderModal()
    await screen.findByDisplayValue('09:00')
    fireEvent.click(screen.getByRole('switch'))
    fireEvent.click(saveButton())
    await waitFor(() => expect(setWindow).toHaveBeenCalled())
    const payload = setWindow.mock.calls[0][1]
    expect(payload).toMatchObject({ enabled: false, start: null, end: null, timezone: null })
  })

  it('says a missing holiday country means holidays are not observed, not that calling stops', async () => {
    // The first version told the admin every call would be refused. That was
    // the behaviour then; it is not the behaviour now, and a warning that
    // overstates the consequence is worse than none.
    renderModal({ ...SPAIN, holiday_country: null })
    expect(await screen.findByText('pages.projects.callingWindow.noCountry')).toBeInTheDocument()
  })

  it('offers a retry instead of loading forever when the window cannot be read', async () => {
    // isLoading goes false on error while the data stays undefined, so the
    // loading branch never ended: the admin saw "Loading…" with no way out.
    getWindow.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <CallingWindowModal projectId={7} projectName="SolventaPro" open onClose={vi.fn()} />
      </QueryClientProvider>
    )
    expect(await screen.findByText('pages.projects.callingWindow.loadFailed')).toBeInTheDocument()
    expect(screen.queryByText('status.loading')).toBeNull()
    expect(screen.getByRole('button', { name: 'actions.retry' })).toBeInTheDocument()
  })

  it('keeps unsaved edits when the admin visits the Holidays tab', async () => {
    // The journey this screen exists for: choose a country, go and generate
    // its calendar, come back. Unmounting the form lost the choice silently.
    renderModal()
    const start = await screen.findByDisplayValue('09:00')
    fireEvent.change(start, { target: { value: '11:30' } })
    fireEvent.click(screen.getByRole('tab', { name: 'pages.projects.callingWindow.tabHolidays' }))
    fireEvent.click(screen.getByRole('tab', { name: 'pages.projects.callingWindow.tabWindow' }))
    expect(screen.getByDisplayValue('11:30')).toBeInTheDocument()
  })

  it('offers a way to clear the holiday country', async () => {
    // "No holiday calendar" is a supported state, but SearchableSelect lists
    // only what it is given — so without an explicit empty entry it was
    // reachable only by never choosing a country in the first place.
    renderModal()
    await screen.findByDisplayValue('09:00')
    await waitFor(() =>
      expect(selectOptions['pages.projects.callingWindow.countryPlaceholder']).toBeTruthy()
    )
    const options = selectOptions['pages.projects.callingWindow.countryPlaceholder']
    expect(options[0].id).toBe('')
    expect(options.map((o) => o.id)).toContain('ES')
  })
})
