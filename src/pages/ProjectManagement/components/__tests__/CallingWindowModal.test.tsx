/**
 * Configuring a project's calling window (KAN-1107).
 *
 * The cases worth pinning are the ones where the form and the API disagree
 * about what a value means — an empty weekday selection above all, which the
 * form shows as "every day" and the API rejects as "no day".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CallingWindowConfig } from '@/features/projects/types'
import { callingWindowKeys } from '@/features/projects/hooks/useCallingWindow'

const setWindow = vi.fn()
const getWindow = vi.fn()

interface SelectOption {
  id: string
  name: string
}
const { selectOptions, selectHandlers } = vi.hoisted(() => ({
  selectOptions: {} as Record<string, SelectOption[]>,
  selectHandlers: {} as Record<string, (next: string) => void>,
}))
// The dropdown's own rendering is not what this file is pinning — what the
// modal hands it is. Recording the props keeps the assertion off
// SearchableSelect's internals, which an unrelated change to it could break.
vi.mock('@/components/ui/SearchableSelect', () => ({
  SearchableSelect: ({
    options,
    placeholder,
    onValueChange,
  }: {
    options: SelectOption[]
    placeholder?: string
    onValueChange: (next: string) => void
  }) => {
    selectOptions[placeholder ?? ''] = options
    selectHandlers[placeholder ?? ''] = onValueChange
    return null
  },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const { panelProps } = vi.hoisted(() => ({
  panelProps: { country: undefined as unknown, countryUnsaved: undefined as unknown },
}))
vi.mock('../HolidayCalendarPanel', () => ({
  HolidayCalendarPanel: ({
    country,
    countryUnsaved,
  }: {
    country: string | null
    countryUnsaved?: boolean
  }) => {
    panelProps.country = country
    panelProps.countryUnsaved = countryUnsaved
    return <div data-testid="holiday-panel" />
  },
}))
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
  // clearAllMocks does not touch this: without it a test can assert against
  // props recorded by an earlier test's render.
  for (const key of Object.keys(selectOptions)) delete selectOptions[key]
  for (const key of Object.keys(selectHandlers)) delete selectHandlers[key]
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

  it('keeps the form when a refresh fails but the last values are still there', async () => {
    // react-query keeps `data` through a failed background refetch, so an
    // error here is "could not refresh", not "nothing to show". Taking the
    // error branch unmounted the form and lost every unsaved edit — the same
    // silent loss the tab-switch fix was written to prevent, by another route.
    getWindow.mockResolvedValue(SPAIN)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <CallingWindowModal projectId={7} projectName="SolventaPro" open onClose={vi.fn()} />
      </QueryClientProvider>
    )
    const start = await screen.findByDisplayValue('09:00')
    fireEvent.change(start, { target: { value: '11:30' } })

    getWindow.mockRejectedValue(new Error('network'))
    await queryClient.refetchQueries()

    expect(screen.getByDisplayValue('11:30')).toBeInTheDocument()
    expect(
      await screen.findByText('pages.projects.callingWindow.refreshFailed')
    ).toBeInTheDocument()
  })

  it('shows the holidays tab the country just selected, not the saved one', async () => {
    // The journey this screen exists for is: pick a country, go and generate
    // its calendar, come back. Handing the panel the server value told the
    // admin "no country is set" for the country they had just picked.
    renderModal({ ...SPAIN, holiday_country: null })
    await screen.findByDisplayValue('09:00')

    const pick = selectHandlers['pages.projects.callingWindow.countryPlaceholder']
    expect(pick).toBeTruthy()
    act(() => pick('ES'))

    fireEvent.click(screen.getByRole('tab', { name: 'pages.projects.callingWindow.tabHolidays' }))
    await waitFor(() => expect(panelProps.country).toBe('ES'))
  })

  it('opens on the window tab even after closing on holidays', async () => {
    // The modal stays mounted across open/close, so the tab outlived the
    // project: opening the window for another project landed on that
    // project's holiday calendar.
    getWindow.mockResolvedValue(SPAIN)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <CallingWindowModal projectId={7} projectName="A" open onClose={vi.fn()} />
      </QueryClientProvider>
    )
    await screen.findByDisplayValue('09:00')
    fireEvent.click(screen.getByRole('tab', { name: 'pages.projects.callingWindow.tabHolidays' }))
    expect(screen.getByTestId('holiday-panel')).toBeInTheDocument()

    const tree = (open: boolean, projectId: number) => (
      <QueryClientProvider client={queryClient}>
        <CallingWindowModal projectId={projectId} projectName="B" open={open} onClose={vi.fn()} />
      </QueryClientProvider>
    )
    rerender(tree(false, 7))
    rerender(tree(true, 9))

    // Waited for the new project's form to be on screen first: the panel is
    // also absent while the reopened modal is loading, so asserting straight
    // after the rerender passes whether or not the tab was reset.
    await screen.findByDisplayValue('09:00')
    expect(screen.queryByTestId('holiday-panel')).not.toBeInTheDocument()
  })

  it('returns to the window tab when the project changes without closing', async () => {
    // The modal body unmounts on close, so closing already resets the tab.
    // Switching project while it stays open does not — and that lands the
    // admin on another project's holiday calendar.
    getWindow.mockResolvedValue(SPAIN)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (projectId: number) => (
      <QueryClientProvider client={queryClient}>
        <CallingWindowModal projectId={projectId} projectName="A" open onClose={vi.fn()} />
      </QueryClientProvider>
    )
    const { rerender } = render(tree(7))
    await screen.findByDisplayValue('09:00')
    fireEvent.click(screen.getByRole('tab', { name: 'pages.projects.callingWindow.tabHolidays' }))
    expect(screen.getByTestId('holiday-panel')).toBeInTheDocument()

    // Primed, so the switch has no loading gap. Without one the body
    // remounts anyway and the tab resets by accident — which is exactly what
    // made this look fixed when it was not.
    queryClient.setQueryData(callingWindowKeys.window(9), SPAIN)
    rerender(tree(9))
    await screen.findByDisplayValue('09:00')
    expect(screen.queryByTestId('holiday-panel')).not.toBeInTheDocument()
  })

  it('tells the holidays tab the selected country is not saved yet', async () => {
    // The panel follows the selection, but generation sends only the project
    // id — the server computes from the persisted country. Without this the
    // Generate button was offered for a country the server had never seen,
    // and the warning that used to block it had been removed.
    renderModal({ ...SPAIN, holiday_country: null })
    await screen.findByDisplayValue('09:00')
    act(() => selectHandlers['pages.projects.callingWindow.countryPlaceholder']('ES'))

    fireEvent.click(screen.getByRole('tab', { name: 'pages.projects.callingWindow.tabHolidays' }))
    await waitFor(() => expect(panelProps.country).toBe('ES'))
    expect(panelProps.countryUnsaved).toBe(true)
  })

  it('does not flag the saved country as unsaved', async () => {
    renderModal(SPAIN)
    await screen.findByDisplayValue('09:00')
    fireEvent.click(screen.getByRole('tab', { name: 'pages.projects.callingWindow.tabHolidays' }))
    await waitFor(() => expect(panelProps.country).toBe('ES'))
    expect(panelProps.countryUnsaved).toBe(false)
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
