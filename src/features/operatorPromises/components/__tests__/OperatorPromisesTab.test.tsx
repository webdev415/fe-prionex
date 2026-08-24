import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import { OperatorPromisesTab } from '../OperatorPromisesTab'
import { getOperatorPromisesReport } from '../../api/operatorPromisesApi'
import { OPERATOR_PROMISES_COLUMN_COUNT } from '../OperatorPromisesTable'
import type { OperatorPromisesReportResponse, OperatorPromisesRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/operatorPromisesApi', () => ({
  getOperatorPromisesReport: vi.fn(),
}))

// Mutable so individual tests can set the profile timezone.
const authState = {
  user: {
    active_project_id: 1,
    projects: [{ id: 1 }],
    timezone: null as string | null,
  },
}

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authState),
}))

// The real DateSelect drags react-datepicker into jsdom; a functional stub
// keeps the tests focused while still driving value/onChange like the real
// component (onChange receives a Date or null). `error` is mirrored the same
// way the real component renders it — a role="alert" paragraph plus
// aria-invalid/aria-describedby on the field — so field-level error wiring is
// assertable here. There is deliberately no "×": both bounds are REQUIRED, so
// the tab passes no `onClear` and the real component renders none either.
//
// `min`/`max` are surfaced as `data-min`/`data-max` and ONLY when the tab
// actually passes them: the real component forwards them to react-datepicker's
// minDate/maxDate, i.e. they are what greys days out. Mirroring them as
// attributes makes "neither picker bounds the other" an assertable fact rather
// than a comment.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
    label,
    error,
    min,
    max,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
    label?: string
    error?: string
    min?: Date | string
    max?: Date | string
  }) => {
    const errorId = `date-select-error-${label ?? ''}`
    return (
      <>
        <input
          data-testid="date-select"
          aria-label={label}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          data-min={min == null ? undefined : String(min)}
          data-max={max == null ? undefined : String(max)}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) =>
            // Noon avoids the parsed UTC date rolling into the previous local day
            onChange?.({ value: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })
          }
        />
        {error && (
          <p id={errorId} role="alert">
            {error}
          </p>
        )}
      </>
    )
  },
}))

const mockGetReport = vi.mocked(getOperatorPromisesReport)

function makeRow(overrides: Partial<OperatorPromisesRow> = {}): OperatorPromisesRow {
  return {
    user_id: 101,
    fio: 'Баженов Олексій Володимирович',
    department: 'Стягнення',
    department_id: 3,
    group_name: 'Група №2',
    is_active: true,
    interactions_count: 314,
    sum_from: '112062.00',
    sum_to: '24000.00',
    paid_full: '31400.00',
    paid_verified: '31400.00',
    unpaid: '-7400.00',
    conversion: '1.308333',
    verified_unpaid: '-7400.00',
    verified_conversion: '1.308333',
    ...overrides,
  }
}

function makeResponse(
  rows: OperatorPromisesRow[],
  overrides: Partial<OperatorPromisesReportResponse> = {}
): OperatorPromisesReportResponse {
  return {
    project_id: 1,
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    timezone: 'UTC',
    rows,
    totals: {
      operators: rows.length,
      interactions_count: 208137,
      sum_from: '34508717.5067',
      sum_to: '33073631.73',
      paid_full: '24773441.41',
      paid_verified: '20000000.00',
      unpaid: '8300190.32',
      conversion: '0.749039',
      verified_unpaid: '13073631.73',
      verified_conversion: '0.604710',
    },
    generated_at: '2026-08-18T13:20:31.400543Z',
    ...overrides,
  }
}

/** Error shaped like an AxiosError so lib/errors + lib/api predicates read it. */
function makeHttpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

function makeNetworkError(code: string) {
  return Object.assign(new Error(code), { isAxiosError: true, code })
}

/** Exposes the current ?search so tests can assert URL-state side effects. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderTab(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <OperatorPromisesTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const search = () => screen.getByTestId('location-search').textContent ?? ''
/** A FIXED sub-tab, whose label is a translation key (i18next is mocked). */
const subTab = (id: string) =>
  screen.getByRole('tab', { name: `pages.reports.operatorPromises.subtabs.${id}` })
/** A DYNAMIC sub-tab, whose label is the department's live name from the rows. */
const departmentTab = (name: string) => screen.getByRole('tab', { name })
const tabLabels = () => screen.getAllByRole('tab').map((tab) => tab.textContent)
/** The totals row for a metric, scoped to the totals block (labels are reused
 *  by the table's column headers, so they exist twice on screen). */
const totalsMetricRow = (container: HTMLElement, metric: string) =>
  within(container.querySelector('section') as HTMLElement)
    .getByText(`pages.reports.operatorPromises.columns.${metric}`)
    .closest('tr') as HTMLElement

const FIXED_TAB_LABELS = [
  'pages.reports.operatorPromises.subtabs.all',
  'pages.reports.operatorPromises.subtabs.tp',
  'pages.reports.operatorPromises.subtabs.dialer',
  'pages.reports.operatorPromises.subtabs.collection',
]

beforeEach(() => {
  vi.clearAllMocks()
  authState.user.timezone = null
})

describe('OperatorPromisesTab', () => {
  // ==========================================================================
  // The window
  // ==========================================================================

  it('requests a today–today window by default and pins nothing into the URL', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    expect(await screen.findByText('Баженов Олексій Володимирович')).toBeInTheDocument()

    // Both bounds are REQUIRED — this endpoint has no default period of its own
    // — and today–today is what the Techno-Finance «Обещания» panel defaults to.
    const [from, to] = dateInputs()
    expect(from.value).toBe(to.value)
    expect(from.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(mockGetReport).toHaveBeenCalledTimes(1)
    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_from: from.value,
      date_to: to.value,
    })
    // A default nobody chose must not travel in a shared link.
    expect(search()).not.toContain('opf=')
    expect(search()).not.toContain('opt=')
    expect(search()).not.toContain('opd=')
  })

  it('resolves "today" in the profile timezone and sends that zone to the API', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Баженов Олексій Володимирович')

    // One function resolves the default day and the zone that travels: the
    // zone moves the PROMISED-date cut only (`sum_to` differs by 112 545 ₴
    // between UTC and Kyiv on the July 2026 window) and `Europe/Kyiv`
    // reproduces Card 102 for summer dates.
    const expectedToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_from: expectedToday,
      date_to: expectedToday,
      timezone: 'Europe/Kyiv',
    })
  })

  it('omits the timezone key entirely for a profile without one', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Баженов Олексій Володимирович')

    // The backend then defaults to UTC — a different report, but an explicit
    // one; an empty string would be a 400.
    const params: Record<string, unknown> = { ...mockGetReport.mock.calls[0][0] }
    expect('timezone' in params).toBe(false)
  })

  it('reads the window from the URL (?opf=&opt=)', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?opf=2026-07-01&opt=2026-07-31'])
    await screen.findByText('Баженов Олексій Володимирович')

    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
    })
    const [from, to] = dateInputs()
    expect(from.value).toBe('2026-07-01')
    expect(to.value).toBe('2026-07-31')
  })

  it.each([
    ['opf', 0, 'date_from'],
    ['opt', 1, 'date_to'],
  ] as const)('writes a picked date into ?%s=', async (urlKey, inputIndex, sentKey) => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    // A wide seeded window keeps the OTHER bound out of the way of the pick.
    renderTab(['/?opf=2026-07-01&opt=2026-07-31'])
    await screen.findByText('Баженов Олексій Володимирович')

    fireEvent.change(dateInputs()[inputIndex], { target: { value: '2026-07-15' } })

    await waitFor(() => expect(search()).toContain(`${urlKey}=2026-07-15`))
    await waitFor(() =>
      expect(mockGetReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ [sentKey]: '2026-07-15' })
      )
    )
  })

  it('does not commit a cleared manual date entry', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?opf=2026-07-01&opt=2026-07-31'])
    await screen.findByText('Баженов Олексій Володимирович')

    // Removing a bound is not a state this report has — both are required, so
    // an abandoned manual entry must leave the URL alone (DateSelect itself
    // resyncs the text on blur).
    fireEvent.change(dateInputs()[0], { target: { value: '' } })

    expect(search()).toContain('opf=2026-07-01')
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  // ==========================================================================
  // Window validation — nothing invalid reaches the API
  // ==========================================================================

  it.each([
    ['opf', 0],
    ['opt', 1],
  ] as const)(
    'refuses an impossible calendar day in ?%s= and fires no request',
    async (urlKey, inputIndex) => {
      mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

      // A shape-only check would let 2026-02-31 through: every comparison against
      // NaN is false, so the range guard would pass and the API would answer 400.
      renderTab([`/?${urlKey}=2026-02-31`])

      const field = dateInputs()[inputIndex]
      await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
      expect(screen.getByRole('alert')).toHaveTextContent(
        'pages.reports.operatorPromises.invalidDate'
      )
      expect(mockGetReport).not.toHaveBeenCalled()
      // The hint sits on the offending field only.
      expect(dateInputs()[inputIndex === 0 ? 1 : 0]).not.toHaveAttribute('aria-invalid')
    }
  )

  it('refuses an inverted window with a pair-level alert and no request', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?opf=2026-07-31&opt=2026-07-01'])

    expect(
      await screen.findByText('pages.reports.operatorPromises.invalidRange')
    ).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
    // Neither bound is wrong on its own, so neither field is marked.
    for (const field of dateInputs()) expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('bounds neither picker by the other — no min/max on either field', async () => {
    // With the today–today default, a mutual min/max opens BOTH calendars with
    // exactly one selectable day: whichever field the user reaches for first is
    // dead, every other day greyed out, and nothing on screen says why. So the
    // tab passes no bounds at all and lets the pair-level guard refuse in words
    // (the test below). This is the regression guard for that: reinstating
    // `min={dateFrom}` on the «по» field fails here.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?opf=2026-07-10&opt=2026-07-31'])
    await screen.findByText('Баженов Олексій Володимирович')

    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('data-min')
      expect(field).not.toHaveAttribute('data-max')
    }
  })

  it('lets an inverted window be PICKED and answers with the guard, not a dead calendar', async () => {
    // The counterpart of the bounds test above: since neither picker refuses an
    // inverted pair, the pair-level guard is what has to, and it does so in
    // words with no request leaving. Scope note: this drives the manual-input
    // path, which bypasses picker bounds anyway — so what is pinned here is the
    // GUARD's behaviour on an inverted pair, not the absence of `min`/`max`.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?opf=2026-07-10&opt=2026-07-31'])
    await screen.findByText('Баженов Олексій Володимирович')
    expect(mockGetReport).toHaveBeenCalledTimes(1)

    // «по» set BEFORE «з».
    fireEvent.change(dateInputs()[1], { target: { value: '2026-07-01' } })

    expect(
      await screen.findByText('pages.reports.operatorPromises.invalidRange')
    ).toBeInTheDocument()
    // The choice is kept (the user can fix either bound), but nothing is sent.
    await waitFor(() => expect(search()).toContain('opt=2026-07-01'))
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('mirrors the backend’s 366-day cap instead of letting it answer 400', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    // 2026-01-01 → 2027-01-03 is a 367-day difference (368 days inclusive).
    renderTab(['/?opf=2026-01-01&opt=2027-01-03'])

    expect(
      await screen.findByText('pages.reports.operatorPromises.rangeTooLong')
    ).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
  })

  it('accepts the widest window the backend allows (367 days inclusive)', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    // _MAX_RANGE_DAYS = 366 is the (end − start) DIFFERENCE, so this is the
    // boundary that must still go through.
    renderTab(['/?opf=2026-01-01&opt=2027-01-02'])
    await screen.findByText('Баженов Олексій Володимирович')

    expect(mockGetReport).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-01-01', date_to: '2027-01-02' })
    )
  })

  it('renders no table at all while the window is invalid', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?opf=2026-07-31&opt=2026-07-01'])

    await screen.findByText('pages.reports.operatorPromises.invalidRange')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  // ==========================================================================
  // URL keys of the other report tabs
  // ==========================================================================

  it('neither consumes nor clobbers the other report tabs’ URL params', async () => {
    // The host page keeps every tab's params in the URL, so this tab renders
    // with the COMPLETE key set of every other tab present: the host's own
    // `tab`, processing (`from`, `to`, `dept`), verification (`sf`, `st`, `cf`,
    // `ct`), the low-verification feed (`pf`, `pt`, `mv`, `pg`, `ps`), the
    // searcher feed (`if`, `it`, `spg`, `sps`) and the communication-gap feed
    // (`gf`, `gt`, `gm`, `gpg`, `gps`). None of them may leak into this tab's
    // request — in particular the processing tab's `from`/`to`, which are dates
    // of exactly this shape — and writing this tab's own keys must leave every
    // one of them untouched. Seeding the whole set (not a sample) is what makes
    // the key-collision check exhaustive: a partial one would pass over a key
    // this tab had quietly started reading or dropping.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    const foreign: Array<[string, string]> = [
      ['tab', 'operator-promises'],
      ['from', '2026-03-03'],
      ['to', '2026-03-31'],
      ['dept', '12'],
      ['sf', '2026-02-02'],
      ['st', '2026-02-28'],
      ['cf', '2026-05-05'],
      ['ct', '2026-05-31'],
      ['pf', '2026-01-01'],
      ['pt', '2026-01-31'],
      ['mv', '4'],
      ['pg', '7'],
      ['ps', '100'],
      ['if', '2026-04-04'],
      ['it', '2026-04-30'],
      ['spg', '5'],
      ['sps', '20'],
      ['gf', '2026-06-01'],
      ['gt', '2026-06-30'],
      ['gm', '10'],
      ['gpg', '3'],
      ['gps', '20'],
    ]

    renderTab([`/?${foreign.map(([k, v]) => `${k}=${v}`).join('&')}`])
    await screen.findByText('Баженов Олексій Володимирович')

    // Foreign date keys are not this tab's window: the request carries today,
    // not `from`/`to`, `sf`/`st`, `pf`/`pt`, `if`/`it` or `gf`/`gt`.
    const [fromInput] = dateInputs()
    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_from: fromInput.value,
      date_to: fromInput.value,
    })
    expect(fromInput.value).not.toBe('2026-03-03')

    // Now write BOTH of this tab's own kinds of state...
    fireEvent.change(dateInputs()[0], { target: { value: '2026-08-05' } })
    await waitFor(() => expect(search()).toContain('opf=2026-08-05'))
    await userEvent.click(subTab('tp'))
    await waitFor(() => expect(search()).toContain('opd=tp'))

    // ...and every foreign key survives verbatim.
    for (const [key, value] of foreign) {
      expect(search()).toContain(`${key}=${value}`)
    }
  })

  // ==========================================================================
  // Department sub-tabs (client-side filtering of one response)
  // ==========================================================================

  const populatedResponse = () =>
    makeResponse([
      makeRow({ user_id: 1, fio: 'Тепенко Тарас', department: 'ТП', department_id: 1 }),
      makeRow({ user_id: 2, fio: 'Дайленко Дмитро', department: 'Дайлер', department_id: 2 }),
      makeRow({ user_id: 3, fio: 'Стягненко Степан', department: 'Стягнення', department_id: 3 }),
      makeRow({ user_id: 4, fio: 'Юристенко Юрій', department: 'Юристи', department_id: 17 }),
      makeRow({
        user_id: 5,
        fio: 'Безвідділенко Богдан',
        department: null,
        department_id: null,
      }),
    ])

  it('opens on «Всі» and shows the departments Techno-Finance drops', async () => {
    // Юристи + Аналітики + no-department held ≈ 631 000 ₴ of July 2026
    // collections that the reference frontend loses silently.
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab()
    await screen.findByText('Тепенко Тарас')

    expect(subTab('all')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Юристенко Юрій')).toBeInTheDocument()
    expect(screen.getByText('Безвідділенко Богдан')).toBeInTheDocument()
  })

  it('lists the fixed tabs in the Techno-Finance order (aggregate first)', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab()
    await screen.findByText('Тепенко Тарас')

    // Юристи is in this response too, so the fixed four come FIRST and the
    // department the card drops rides after them, not among them.
    expect(tabLabels()).toEqual([...FIXED_TAB_LABELS, 'Юристи'])
  })

  // --------------------------------------------------------------------------
  // Dynamic department tabs (keyed by department_id, labelled from the data)
  // --------------------------------------------------------------------------

  it('gives a department outside the fixed triple a tab of its own', async () => {
    // Юристи + Аналітики + no-department held ≈ 631 000 ₴ of July 2026
    // collections. «Всі» always showed them; now each named department is one
    // click away instead of buried in the aggregate.
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab()
    await screen.findByText('Тепенко Тарас')

    await userEvent.click(departmentTab('Юристи'))

    expect(await screen.findByText('Юристенко Юрій')).toBeInTheDocument()
    expect(screen.queryByText('Тепенко Тарас')).not.toBeInTheDocument()
    // Still one request: the dynamic tabs filter the same response.
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('orders the departments beyond the triple alphabetically, in the reader’s locale', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow({ user_id: 1, department: 'Ялинка', department_id: 40 }),
        makeRow({ user_id: 2, department: 'Юристи', department_id: 17 }),
        makeRow({ user_id: 3, department: 'Аналітики', department_id: 21 }),
        // A department the triple already claims earns no second tab...
        makeRow({ user_id: 4, department: 'ТП', department_id: 1 }),
        // ...and an operator with no department earns none at all.
        makeRow({ user_id: 5, department: null, department_id: null }),
      ])
    )

    renderTab()
    await screen.findByRole('tab', { name: 'Аналітики' })

    expect(tabLabels()).toEqual([...FIXED_TAB_LABELS, 'Аналітики', 'Юристи', 'Ялинка'])
  })

  it('keeps the fixed triple in the strip even when the response is empty', async () => {
    // The strip must not change shape with the period: "ТП did nothing this
    // week" and "ТП is gone" are different facts and must not look alike.
    mockGetReport.mockResolvedValue(makeResponse([]))

    renderTab()
    await screen.findByText('pages.reports.operatorPromises.empty')

    expect(tabLabels()).toEqual(FIXED_TAB_LABELS)
  })

  it('gives the operators without a department no tab, so they are read on «Всі»', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab()
    await screen.findByText('Тепенко Тарас')

    // No stable key to tab on — and by contract a null id comes with a null
    // name, so the triple's name match cannot claim them either.
    expect(tabLabels()).toEqual([...FIXED_TAB_LABELS, 'Юристи'])
    expect(screen.getByText('Безвідділенко Богдан')).toBeInTheDocument()

    for (const openTab of [
      () => userEvent.click(subTab('tp')),
      () => userEvent.click(subTab('dialer')),
      () => userEvent.click(subTab('collection')),
      () => userEvent.click(departmentTab('Юристи')),
    ]) {
      await openTab()
      await waitFor(() =>
        expect(screen.queryByText('Безвідділенко Богдан')).not.toBeInTheDocument()
      )
    }

    await userEvent.click(subTab('all'))
    expect(await screen.findByText('Безвідділенко Богдан')).toBeInTheDocument()
  })

  it('writes a picked dynamic sub-tab into ?opd= as d{department_id}', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab()
    await screen.findByText('Тепенко Тарас')

    await userEvent.click(departmentTab('Юристи'))

    // The ID travels, never the name: the link survives the next rename.
    await waitFor(() => expect(search()).toContain('opd=d17'))
  })

  it('restores a dynamic sub-tab from ?opd=d17 when the rows arrive', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab(['/?opd=d17'])

    expect(await screen.findByText('Юристенко Юрій')).toBeInTheDocument()
    expect(departmentTab('Юристи')).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Тепенко Тарас')).not.toBeInTheDocument()
    // Wired for assistive technology exactly like the fixed tabs.
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'operator-promises-panel-d17')
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'operator-promises-tab-d17'
    )
  })

  it('falls back to «Всі» for a dynamic ?opd= this response has no department for', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab(['/?opd=d999'])
    await screen.findByText('Тепенко Тарас')

    expect(subTab('all')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Юристенко Юрій')).toBeInTheDocument()
    // SILENTLY: the key stays in the URL. It is a view preference, and the
    // department may well exist in the next period the user picks — rewriting
    // it would also destroy every deep link during the first render, when no
    // rows have arrived yet and no dynamic tab exists.
    expect(search()).toContain('opd=d999')
  })

  it('moves a renamed department’s money onto a new tab instead of hiding it', async () => {
    // The scenario the whole design exists for. «ТП» (department_id 1) is
    // renamed to «Технічна підтримка» in the auth directory: the rows come back
    // with the SAME id under the NEW name.
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow({
          user_id: 1,
          fio: 'Тепенко Тарас',
          department: 'Технічна підтримка',
          department_id: 1,
          sum_to: '2000.00',
          paid_full: '1000.00',
        }),
        makeRow({
          user_id: 2,
          fio: 'Тищенко Тимур',
          department: 'Технічна підтримка',
          department_id: 1,
          sum_to: '500.00',
          paid_full: '250.00',
        }),
        makeRow({
          user_id: 3,
          fio: 'Дайленко Дмитро',
          department: 'Дайлер',
          department_id: 2,
          sum_to: '9000.00',
          paid_full: '9000.00',
        }),
      ])
    )

    const { container } = renderTab(['/?opd=tp'])

    // The fixed ТП tab is still in the strip and is honest about being empty —
    // it does NOT claim the period produced nothing.
    expect(
      await screen.findByText('pages.reports.operatorPromises.emptyDepartment')
    ).toBeInTheDocument()
    expect(subTab('tp')).toHaveAttribute('aria-selected', 'true')

    // …and right beside it, a tab under the department's new name.
    await userEvent.click(departmentTab('Технічна підтримка'))

    expect(await screen.findByText('Тепенко Тарас')).toBeInTheDocument()
    expect(screen.getByText('Тищенко Тимур')).toBeInTheDocument()
    expect(screen.queryByText('Дайленко Дмитро')).not.toBeInTheDocument()
    await waitFor(() => expect(search()).toContain('opd=d1'))

    // The money is all there: the visible totals are the sum of exactly these
    // two rows (1 000 + 250), not the period's 10 250.
    expect(within(totalsMetricRow(container, 'paidFull')).getByText('1,250.00')).toBeInTheDocument()
    expect(within(totalsMetricRow(container, 'sumTo')).getByText('2,500.00')).toBeInTheDocument()
    // Conversion is recomputed from the visible sums, never averaged.
    expect(within(totalsMetricRow(container, 'conversion')).getByText('50.00%')).toBeInTheDocument()
  })

  it('heads the visible totals column with the department’s live name', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab(['/?opd=d17'])
    await screen.findByText('Юристенко Юрій')

    // No locale file can know this string — it is the directory's own.
    expect(screen.getByRole('columnheader', { name: 'Юристи' })).toBeInTheDocument()
  })

  it('filters client-side on a sub-tab switch without refetching', async () => {
    // One request serves all four sub-tabs, exactly as in Techno-Finance — the
    // backend applies no department filter at all.
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab()
    await screen.findByText('Тепенко Тарас')

    await userEvent.click(subTab('dialer'))

    expect(await screen.findByText('Дайленко Дмитро')).toBeInTheDocument()
    expect(screen.queryByText('Тепенко Тарас')).not.toBeInTheDocument()
    expect(screen.queryByText('Безвідділенко Богдан')).not.toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('writes a picked sub-tab into ?opd= and drops the key again for «Всі»', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab()
    await screen.findByText('Тепенко Тарас')

    await userEvent.click(subTab('collection'))
    await waitFor(() => expect(search()).toContain('opd=collection'))

    await userEvent.click(subTab('all'))
    // The default is the ABSENCE of the key, never a spelled-out `opd=all`.
    await waitFor(() => expect(search()).not.toContain('opd='))
  })

  it('reads the sub-tab from ?opd=', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab(['/?opd=tp'])
    await screen.findByText('Тепенко Тарас')

    expect(subTab('tp')).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Стягненко Степан')).not.toBeInTheDocument()
  })

  it('falls back to «Всі» for an unknown ?opd=', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab(['/?opd=lawyers'])
    await screen.findByText('Тепенко Тарас')

    expect(subTab('all')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Юристенко Юрій')).toBeInTheDocument()
  })

  it('wires the panel to the active sub-tab for assistive technology', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab(['/?opd=dialer'])
    await screen.findByText('Дайленко Дмитро')

    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('id', 'operator-promises-panel-dialer')
    expect(panel).toHaveAttribute('aria-labelledby', 'operator-promises-tab-dialer')
  })

  it('says the DEPARTMENT is empty when the period is not', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow({ department: 'ТП' })]))

    renderTab(['/?opd=dialer'])

    // "No data for the selected period" would be a lie here: the period has
    // data, this tab just does not match it. It is also the only shape in which
    // a department renamed in the auth directory can ever surface — the tabs
    // match a display string — so the message sends the reader to «Всі».
    expect(
      await screen.findByText('pages.reports.operatorPromises.emptyDepartment')
    ).toBeInTheDocument()
    expect(screen.queryByText('pages.reports.operatorPromises.empty')).not.toBeInTheDocument()
  })

  it('does not mask a renamed department as an empty period', async () => {
    // The fixed tab's half of the rename: it goes blank and says so, while
    // «Всі» still holds the row and the money. (The other half — the new tab
    // that now carries them — is pinned further down.)
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow({ fio: 'Тепенко Тарас', department: 'Технічна підтримка', department_id: 1 }),
      ])
    )

    renderTab(['/?opd=tp'])

    expect(
      await screen.findByText('pages.reports.operatorPromises.emptyDepartment')
    ).toBeInTheDocument()

    await userEvent.click(subTab('all'))
    expect(await screen.findByText('Тепенко Тарас')).toBeInTheDocument()
  })

  it('keeps the calm period message for a genuinely empty answer', async () => {
    // A normal 200 with no rows at all: nobody touched a chain run or collected
    // money in the period — nothing is hidden, so nothing is claimed either.
    mockGetReport.mockResolvedValue(makeResponse([]))

    renderTab(['/?opd=dialer'])

    expect(await screen.findByText('pages.reports.operatorPromises.empty')).toBeInTheDocument()
    expect(
      screen.queryByText('pages.reports.operatorPromises.emptyDepartment')
    ).not.toBeInTheDocument()
  })

  it('never shows the department message on «Всі», which filters nothing', async () => {
    mockGetReport.mockResolvedValue(makeResponse([]))

    renderTab()

    expect(await screen.findByText('pages.reports.operatorPromises.empty')).toBeInTheDocument()
    expect(
      screen.queryByText('pages.reports.operatorPromises.emptyDepartment')
    ).not.toBeInTheDocument()
  })

  // ==========================================================================
  // Totals
  // ==========================================================================

  it('recomputes the visible totals per sub-tab beside the backend’s period totals', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse(
        [
          makeRow({ user_id: 1, fio: 'Тепенко Тарас', department: 'ТП', paid_full: '1000.00' }),
          makeRow({
            user_id: 2,
            fio: 'Дайленко Дмитро',
            department: 'Дайлер',
            paid_full: '500.00',
          }),
        ],
        {
          totals: {
            operators: 136,
            interactions_count: 208137,
            sum_from: '34508717.5067',
            sum_to: '33073631.73',
            paid_full: '24773441.41',
            paid_verified: '20000000.00',
            unpaid: '8300190.32',
            conversion: '0.749039',
            verified_unpaid: '13073631.73',
            verified_conversion: '0.604710',
          },
        }
      )
    )

    const { container } = renderTab(['/?opd=tp'])
    await screen.findByText('Тепенко Тарас')

    // Scoped to the totals block: its metric labels reuse the table's column
    // keys on purpose (one label per metric), so they exist twice on screen.
    const totals = within(container.querySelector('section') as HTMLElement)
    const paidRow = totals
      .getByText('pages.reports.operatorPromises.columns.paidFull')
      .closest('tr') as HTMLElement
    // Only the ТП operator's money on the left...
    expect(within(paidRow).getByText('1,000.00')).toBeInTheDocument()
    // ...and the whole period, every department included, on the right.
    expect(within(paidRow).getByText('24,773,441.41')).toBeInTheDocument()
  })

  it('labels the visible column with the active sub-tab', async () => {
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab(['/?opd=collection'])
    await screen.findByText('Стягненко Степан')

    expect(
      screen.getByRole('columnheader', {
        name: 'pages.reports.operatorPromises.subtabs.collection',
      })
    ).toBeInTheDocument()
  })

  it('states when the report was computed', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Баженов Олексій Володимирович')

    // The answer can be up to 15 minutes old (worker-local server cache), and
    // `generated_at` is stamped at computation time.
    expect(
      screen.getByText(/^pages\.reports\.operatorPromises\.totals\.generatedAt:/)
    ).toBeInTheDocument()
  })

  // ==========================================================================
  // Dismissed operators
  // ==========================================================================

  it('shows a dismissed operator, marked, instead of hiding their money', async () => {
    // The card's `status = 'active'` gate hid 21 operators and 859 523.80 ₴ of
    // July 2026 collections; the backend keeps them and flags `is_active`.
    mockGetReport.mockResolvedValue(
      makeResponse([makeRow({ fio: 'Звільненко Захар', is_active: false })])
    )

    renderTab()
    await screen.findByText('Звільненко Захар')

    expect(screen.getByText('pages.reports.operatorPromises.inactiveBadge')).toBeInTheDocument()
  })

  // ==========================================================================
  // The error ladder
  // ==========================================================================

  it('shows a permission message and no Retry on 403', async () => {
    mockGetReport.mockRejectedValue(makeHttpError(403, { detail: 'Forbidden' }))

    renderTab()

    expect(await screen.findByText('pages.reports.operatorPromises.forbidden')).toBeInTheDocument()
    // Retrying cannot fix missing permissions.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.operatorPromises.error.retry' })
    ).not.toBeInTheDocument()
  })

  it('shows the localized unavailable message AND the server’s own 503 detail', async () => {
    // The three 503s are worded distinctly on purpose (payment-service down,
    // auth directory down, fan-out deadline blown): the remedies differ and
    // monitoring must tell an outage from a timeout, so the server sentence
    // rides UNDER the localized one rather than replacing it.
    mockGetReport.mockRejectedValue(
      makeHttpError(503, { detail: 'Payment totals (payment-service) are unavailable' })
    )

    renderTab()

    expect(
      await screen.findByText('pages.reports.operatorPromises.unavailable')
    ).toBeInTheDocument()
    expect(screen.getByText('Payment totals (payment-service) are unavailable')).toBeInTheDocument()
  })

  it('distinguishes the directory 503 from the payment 503', async () => {
    mockGetReport.mockRejectedValue(
      makeHttpError(503, { detail: 'Employee directory (auth-service) is unavailable' })
    )

    renderTab()

    expect(
      await screen.findByText('Employee directory (auth-service) is unavailable')
    ).toBeInTheDocument()
  })

  it('shows no detail line for a 503 whose body never arrived', async () => {
    mockGetReport.mockRejectedValue(makeHttpError(503))

    renderTab()

    expect(
      await screen.findByText('pages.reports.operatorPromises.unavailable')
    ).toBeInTheDocument()
    // axios' own "Request failed with status code 503" is not a sentence to
    // show an operator.
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it('treats a network failure as transient, with nothing to quote', async () => {
    mockGetReport.mockRejectedValue(makeNetworkError('ECONNABORTED'))

    renderTab()

    expect(
      await screen.findByText('pages.reports.operatorPromises.unavailable')
    ).toBeInTheDocument()
    expect(screen.queryByText(/ECONNABORTED/)).not.toBeInTheDocument()
  })

  it('passes a 400 detail through verbatim so the refusal is actionable', async () => {
    // Backend date/timezone validation: an inverted window, a window over 367
    // days, a date outside 1900-01-01..9998-12-31, an unknown IANA zone.
    mockGetReport.mockRejectedValue(
      makeHttpError(400, { detail: 'Unknown IANA timezone: Mars/Olympus' })
    )

    renderTab()

    expect(await screen.findByText('Unknown IANA timezone: Mars/Olympus')).toBeInTheDocument()
  })

  it.each([
    ['an empty body', undefined],
    ['a body with no detail', {}],
    ['an empty detail string', { detail: '   ' }],
    // An empty array makes getErrorMessage return its hardcoded English
    // "Validation error occurred" — no more fit to show than the axios text.
    ['an empty detail array', { detail: [] }],
  ])('falls back to the localized title for a 400 with %s', async (_case, data) => {
    mockGetReport.mockRejectedValue(makeHttpError(400, data))

    renderTab()

    expect(
      await screen.findByText('pages.reports.operatorPromises.error.title')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it('shows the generic title for the malformed-promise 500', async () => {
    // A deliberate, diagnosable server-side failure: guarding the cast would
    // silently drop money from an operator's totals. Nothing here is actionable
    // for the operator, so no server text is quoted.
    mockGetReport.mockRejectedValue(makeHttpError(500, { detail: 'Malformed promise value' }))

    renderTab()

    expect(
      await screen.findByText('pages.reports.operatorPromises.error.title')
    ).toBeInTheDocument()
  })

  it('retries the report when the Retry button is used', async () => {
    mockGetReport
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('pages.reports.operatorPromises.error.title')

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.operatorPromises.error.retry' })
    )

    expect(await screen.findByText('Баженов Олексій Володимирович')).toBeInTheDocument()
  })

  // ==========================================================================
  // Loading and shape
  // ==========================================================================

  it('shows a skeleton as wide as the real table while the first report loads', async () => {
    mockGetReport.mockImplementation(() => new Promise(() => {}))

    const { container } = renderTab()

    await waitFor(() =>
      expect(container.querySelectorAll('thead th').length).toBe(OPERATOR_PROMISES_COLUMN_COUNT)
    )
  })

  it('renders no pagination — the whole roster arrives in one answer', async () => {
    // ~136 rows for a month; a page would only add a stateful contract to
    // something the frontend renders in full and groups itself.
    mockGetReport.mockResolvedValue(populatedResponse())

    renderTab()
    await screen.findByText('Тепенко Тарас')

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next|prev/i })).not.toBeInTheDocument()
  })
})

describe('OperatorPromises locale keys', () => {
  // The tab renders KEYS in tests (react-i18next is mocked globally), so
  // nothing above would notice a key added to one locale only — these read the
  // actual translation files.
  const uk = ukCommon.pages.reports.operatorPromises
  const en = enCommon.pages.reports.operatorPromises

  function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return value && typeof value === 'object' && !Array.isArray(value)
        ? flatten(value as Record<string, unknown>, path)
        : [path]
    })
  }

  it('carries the same key set, and the same number of keys, in both locales', () => {
    const ukKeys = flatten(uk).sort()
    const enKeys = flatten(en).sort()

    expect(ukKeys).toEqual(enKeys)
    expect(ukKeys).toHaveLength(enKeys.length)
  })

  it('spells the two empty states differently in both locales', () => {
    // The whole point of `emptyDepartment` is that it does NOT say "no data for
    // the period" — a duplicated string would silently restore the masking.
    expect(uk.emptyDepartment).toBeTruthy()
    expect(en.emptyDepartment).toBeTruthy()
    expect(uk.emptyDepartment).not.toBe(uk.empty)
    expect(en.emptyDepartment).not.toBe(en.empty)
    // …and it names «Всі» / «All», the tab that certainly holds the rows.
    expect(uk.emptyDepartment).toContain(uk.subtabs.all)
    expect(en.emptyDepartment).toContain(en.subtabs.all)
  })
})
