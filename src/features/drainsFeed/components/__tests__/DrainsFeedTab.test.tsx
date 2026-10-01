import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import { DrainsFeedTab } from '../DrainsFeedTab'
import { getDrainsFeed } from '../../api/drainsFeedApi'
import type { DrainsFeedResponse, DrainsFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/drainsFeedApi', () => ({
  getDrainsFeed: vi.fn(),
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
// component (onChange receives a Date or null), mirroring the sibling feed tab
// tests. `error` follows the real contract — a role="alert" paragraph plus
// aria-invalid/aria-describedby on the field — and `min`/`max` are surfaced as
// data attributes ONLY when the tab actually passes them, so "neither picker
// bounds the other" stays an assertable fact.
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

// The default-window rule stays REAL for every test below (the weekday cases
// are the point of this suite); this switch only lets one test make it refuse,
// which is otherwise reachable only through a malformed "today".
const defaultWindowRefuses = { value: false }
vi.mock('../../lib/previousWorkingDayWindow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/previousWorkingDayWindow')>()
  return {
    ...actual,
    previousWorkingDayWindow: (today: string) =>
      defaultWindowRefuses.value ? null : actual.previousWorkingDayWindow(today),
  }
})

const mockGetFeed = vi.mocked(getDrainsFeed)

function makeRow(overrides: Partial<DrainsFeedRow> = {}): DrainsFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    // A fortnight older than the promised day — the window's axis is the
    // promise, not the conversation that produced it.
    interaction_date: '2026-08-26T06:14:03Z',
    interaction_type: 'Часткова оплата',
    promise_date: '2026-09-11T06:00:00Z',
    promise_amount: '1500.00',
    employee_interacted: 'Коваленко Іван Петрович',
    employee_responsible: 'Мельник Ольга Ігорівна',
    link: 'https://crm-prionex.online/dashboard/clients/84213',
    payment_amount: '0.00',
    last_interaction_date: '2026-09-10',
    last_result: '',
    department: 'Стягнення',
    group_name: 'Полка',
    ...overrides,
  }
}

function makeResponse(
  rows: DrainsFeedRow[],
  overrides: Partial<DrainsFeedResponse> = {}
): DrainsFeedResponse {
  return {
    project_id: 1,
    date_from: '2026-09-11',
    date_to: '2026-09-13',
    hide_worked_today: false,
    hide_worked: false,
    hide_paid: false,
    rows,
    total: rows.length,
    page: 1,
    page_size: 50,
    total_pages: rows.length > 0 ? 1 : 0,
    generated_at: '2026-09-14T09:00:00Z',
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
        <DrainsFeedTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const search = () => screen.getByTestId('location-search').textContent ?? ''
const allHistoryCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.drainsFeed.allHistory' })
const hideWorkedTodayCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.drainsFeed.hideWorkedToday' })
const hideWorkedCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.drainsFeed.hideWorked' })
const hidePaidCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.drainsFeed.hidePaid' })

// The shared Pagination's rows-per-page control is a Radix Select, which uses
// pointer-capture / scroll APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  authState.user.timezone = null
  defaultWindowRefuses.value = false
})

afterEach(() => {
  // Several tests below fake Date (only Date — real timers keep waitFor,
  // React Query and userEvent flowing); a no-op for the rest.
  vi.useRealTimers()
})

describe('DrainsFeedTab', () => {
  // ==========================================================================
  // The default window — the PREVIOUS WORKING DAY, never today
  // ==========================================================================

  describe('the default window', () => {
    // Only Date is faked: real timers keep waitFor / React Query / userEvent
    // flowing, while setSystemTime moves what "now" (and thus "today", and
    // thus which WEEKDAY it is) means.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('gives a MONDAY the three-day Friday–Sunday window, and sends it explicitly', async () => {
      // The rule that separates this tab from every sibling: 2026-09-14 is a
      // Monday, so the window is 11..13 September and the weekend is not lost.
      // A `fallbackFrom: today` copied from a neighbour would send 14–14 here
      // and the page would look perfectly fine.
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-14T09:00:00Z')) // 12:00 Mon, Kyiv
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()

      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(mockGetFeed).toHaveBeenCalledWith({
        project_id: 1,
        date_from: '2026-09-11',
        date_to: '2026-09-13',
        skip: 0,
        limit: 50,
        timezone: 'Europe/Kyiv',
      })

      // The fields show the default...
      const [dateFrom, dateTo] = dateInputs()
      expect(dateFrom.value).toBe('2026-09-11')
      expect(dateTo.value).toBe('2026-09-13')
      // ...but an auto-derived value is never pinned into the URL: a shared
      // link would otherwise freeze the window to the day the link was made.
      // The backend defaults (all three toggles off, windowed mode) stay
      // absent too.
      expect(search()).not.toContain('drf=')
      expect(search()).not.toContain('drt=')
      expect(search()).not.toContain('dra=')
      expect(search()).not.toContain('drwt=')
      expect(search()).not.toContain('drw=')
      expect(search()).not.toContain('drp=')
    })

    it('gives an ordinary weekday yesterday–yesterday, and never includes today', async () => {
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-16T09:00:00Z')) // 12:00 Wed, Kyiv
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')

      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-09-15', date_to: '2026-09-15' })
      )
      // Today is emphatically not in it — the sharpest difference from every
      // sibling feed on this page.
      const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
      expect(params.date_to).not.toBe('2026-09-16')
    })

    it('reads the weekday in the PROFILE timezone, not the browser’s', async () => {
      // UTC+14 at 12:00 UTC on a Sunday is already MONDAY for the operator, so
      // the window must be the three-day one. A browser(UTC)-local resolution
      // would see Sunday and send 2026-09-12..2026-09-12 — a plausible window
      // that silently drops two days of promises.
      authState.user.timezone = 'Pacific/Kiritimati'
      vi.setSystemTime(new Date('2026-09-13T12:00:00Z')) // 02:00 Mon, Kiritimati
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')

      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2026-09-11',
          date_to: '2026-09-13',
          timezone: 'Pacific/Kiritimati',
        })
      )
    })

    it('rolls the default over on a focus after midnight, and re-reads the weekday with it', async () => {
      // Mounted on a Sunday (window = Saturday), left open across midnight and
      // focused again on the Monday — where the rule widens the window to
      // three days. A render read of the wall clock would keep Sunday's window
      // until some unrelated re-render happened to recompute it.
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-13T09:00:00Z')) // 12:00 Sun, Kyiv
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-09-12', date_to: '2026-09-12' })
      )

      vi.setSystemTime(new Date('2026-09-14T05:00:00Z')) // 08:00 Mon, Kyiv
      fireEvent(window, new Event('focus'))

      await waitFor(() =>
        expect(mockGetFeed).toHaveBeenLastCalledWith(
          expect.objectContaining({ date_from: '2026-09-11', date_to: '2026-09-13' })
        )
      )
      const [dateFrom, dateTo] = dateInputs()
      expect(dateFrom.value).toBe('2026-09-11')
      expect(dateTo.value).toBe('2026-09-13')
      expect(search()).not.toContain('drf=')
    })

    it('leaves a user-picked window alone when the day rolls over', async () => {
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-13T20:55:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?drf=2026-06-01&drt=2026-06-30'])
      await screen.findByText('Коваленко Іван Петрович')

      vi.setSystemTime(new Date('2026-09-14T05:00:00Z'))
      fireEvent(window, new Event('focus'))

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      // `today` only backs the DEFAULT window: with both bounds picked in the
      // URL, the rollover neither refetches nor moves what is sent or shown.
      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-06-01', date_to: '2026-06-30' })
      )
    })
  })

  it('falls back to the BROWSER timezone for a profile without one — the param always goes out', async () => {
    // An omitted param would make the backend cut the window by UTC while the
    // table renders the datetimes browser-locally. It matters more here than
    // on the siblings: 11.98 % of this card's promises change calendar day
    // under the Kyiv shift.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect(params.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    // The default still goes out as an explicit pair.
    expect(typeof params.date_from).toBe('string')
    expect(typeof params.date_to).toBe('string')
  })

  // ==========================================================================
  // The all-history mode — the one thing no sibling tab has
  // ==========================================================================

  describe('the all-history mode', () => {
    it('sends the request with NO date params at all when ?dra=1', async () => {
      // The endpoint's own mode: both dates absent means the whole history
      // (~11.3k rows), not "the default window". Empty strings or nulls would
      // be PRESENT parameters and earn a 400 for a half-specified window.
      mockGetFeed.mockResolvedValue(
        makeResponse([makeRow()], { date_from: null, date_to: null, total: 11314 })
      )

      renderTab(['/?dra=1'])
      await screen.findByText('Коваленко Іван Петрович')

      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
      expect('date_from' in params).toBe(false)
      expect('date_to' in params).toBe(false)
      // The zone still travels: it anchors "today" for the worked flag and for
      // the right edge of the payment window, which is this feed's row gate.
      expect(params.timezone).toBeTruthy()

      // Both fields show empty — there is no bound to display.
      const [dateFrom, dateTo] = dateInputs()
      expect(dateFrom.value).toBe('')
      expect(dateTo.value).toBe('')
      expect(allHistoryCheckbox()).toBeChecked()
    })

    it('switches the mode on, clearing both bounds and the page in one URL update', async () => {
      mockGetFeed.mockResolvedValue(
        makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
      )

      renderTab(['/?drf=2026-09-01&drt=2026-09-07&drpg=3'])
      await screen.findByText('Коваленко Іван Петрович')
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: '2026-09-01', skip: 100 })
      )

      await userEvent.click(allHistoryCheckbox())

      await waitFor(() => expect(search()).toContain('dra=1'))
      // A bound left in the URL would be a value the request does not use —
      // and, on the next hand-edit, a half-specified window.
      await waitFor(() => expect(search()).not.toContain('drf='))
      expect(search()).not.toContain('drt=')
      // The page goes with them: the whole history has different pages.
      expect(search()).not.toContain('drpg=')
      await waitFor(() => {
        const params: Record<string, unknown> = {
          ...mockGetFeed.mock.calls[mockGetFeed.mock.calls.length - 1][0],
        }
        expect('date_from' in params).toBe(false)
        expect(params.skip).toBe(0)
      })
    })

    it('switches the mode off back to the previous working day, without spelling it out in the URL', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-16T09:00:00Z')) // Wednesday
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?dra=1'])
      await screen.findByText('Коваленко Іван Петрович')
      expect(allHistoryCheckbox()).toBeChecked()

      await userEvent.click(allHistoryCheckbox())

      // The off state is the ABSENCE of the key, never a spelled-out `dra=0`.
      await waitFor(() => expect(search()).not.toContain('dra='))
      await waitFor(() =>
        expect(mockGetFeed).toHaveBeenLastCalledWith(
          expect.objectContaining({ date_from: '2026-09-15', date_to: '2026-09-15' })
        )
      )
      // …and the restored default is still not written into the URL.
      expect(search()).not.toContain('drf=')
    })

    it('leaves the mode when a date is picked — the flag and a window cannot both hold', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-16T09:00:00Z')) // Wednesday
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?dra=1'])
      await screen.findByText('Коваленко Іван Петрович')

      fireEvent.change(dateInputs()[0], { target: { value: '2026-09-05' } })

      // The flag goes in the SAME update as the bound — otherwise the checkbox
      // would claim "the whole history" above an applied window, and the OTHER
      // bound would be missing, which is a 400.
      await waitFor(() => expect(search()).toContain('drf=2026-09-05'))
      await waitFor(() => expect(search()).not.toContain('dra='))
      await waitFor(() =>
        expect(mockGetFeed).toHaveBeenLastCalledWith(
          expect.objectContaining({ date_from: '2026-09-05', date_to: '2026-09-15' })
        )
      )
      expect(allHistoryCheckbox()).not.toBeChecked()
    })

    it.each([
      ['a lower bound only', '/?dra=1&drf=2026-09-01', 1],
      ['an upper bound only', '/?dra=1&drt=2026-09-07', 0],
    ])(
      'refuses a hand-edited half window (%s) instead of sending one bound',
      async (_case, entry, missingIndex) => {
        // The endpoint's dates are BOTH-OR-NEITHER and one bound answers 400.
        // The shared window hook deliberately ALLOWS a half-specified window
        // (several tabs want an open-ended filter), so this rule is the tab's
        // own — and unreachable through the UI, which is why only a
        // hand-edited link can get here.
        mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

        renderTab([entry])

        expect(
          await screen.findByText('pages.reports.drainsFeed.bothOrNeither')
        ).toBeInTheDocument()
        expect(mockGetFeed).not.toHaveBeenCalled()

        // The complaint rides the field that is MISSING its date — that is
        // where the action is. The bound that IS filled is not marked wrong.
        const fields = dateInputs()
        expect(fields[missingIndex]).toHaveAttribute('aria-invalid', 'true')
        expect(fields[1 - missingIndex]).not.toHaveAttribute('aria-invalid')
        const describedBy = fields[missingIndex].getAttribute('aria-describedby')
        expect(document.getElementById(describedBy as string)).toHaveTextContent(
          'pages.reports.drainsFeed.bothOrNeither'
        )
      }
    )

    it('refuses a hand-edited FULL window under the mode flag — the checkbox must not lie', async () => {
      // `?dra=1&drf=…&drt=…` is what a shared link looks like after someone
      // edits it: the mode says "no window", the fields say otherwise. Before
      // this case the tab sent the 30-day window with the checkbox CHECKED —
      // a switch that visibly did nothing. Now both dates are the intruders:
      // the complaint rides both fields and nothing is requested.
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?dra=1&drf=2026-09-01&drt=2026-09-30'])

      expect(
        (await screen.findAllByText('pages.reports.drainsFeed.bothOrNeither')).length
      ).toBeGreaterThanOrEqual(1)
      expect(mockGetFeed).not.toHaveBeenCalled()
      expect(allHistoryCheckbox()).toBeChecked()
      const fields = dateInputs()
      expect(fields[0]).toHaveAttribute('aria-invalid', 'true')
      expect(fields[1]).toHaveAttribute('aria-invalid', 'true')
    })

    it('recovers from a half window by switching the mode off', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-16T09:00:00Z')) // Wednesday
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?dra=1&drf=2026-09-01'])
      expect(await screen.findByText('pages.reports.drainsFeed.bothOrNeither')).toBeInTheDocument()

      await userEvent.click(allHistoryCheckbox())

      // Without the flag the absent upper bound means the default again, so
      // the pair is whole and the request goes out.
      expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-09-01', date_to: '2026-09-15' })
      )
    })

    it('does NOT slip into the mode when the default window rule refuses the day', async () => {
      // Both fallbacks undefined is exactly the shape of the all-history mode,
      // so a refused default would otherwise request the whole history
      // (~11.3k rows) with the mode checkbox showing unchecked — a different,
      // far heavier report, silently. It takes a malformed "today" to get
      // there; the guard is what keeps the failure visible instead of costly.
      defaultWindowRefuses.value = true
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()

      // BOTH fields carry it here — both are empty, and either one is a valid
      // place to act from (the third option, switching the mode on, is the
      // checkbox right next to them).
      expect(await screen.findAllByText('pages.reports.drainsFeed.bothOrNeither')).toHaveLength(2)
      expect(mockGetFeed).not.toHaveBeenCalled()
      expect(allHistoryCheckbox()).not.toBeChecked()
    })

    it('does not cap the all-history mode — there is no window to measure', async () => {
      // The endpoint caps the DIFFERENCE of a window at 366 days; the widest
      // request it accepts is the one with no window at all, bounded by a
      // candidate ceiling instead. A cap guard that fired on the mode would
      // make it unreachable.
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { date_from: null, date_to: null }))

      renderTab(['/?dra=1'])
      await screen.findByText('Коваленко Іван Петрович')

      expect(screen.queryByText('pages.reports.drainsFeed.rangeTooLong')).not.toBeInTheDocument()
      expect(mockGetFeed).toHaveBeenCalledTimes(1)
    })
  })

  // ==========================================================================
  // URL round-trip and foreign keys
  // ==========================================================================

  it('round-trips every filter and the page window through the URL (?drf=&drt=&drwt=&drw=&drp=&drpg=&drps=)', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 2, page_size: 100, total_pages: 3 })
    )

    renderTab(['/?drf=2026-09-01&drt=2026-09-07&drwt=1&drw=1&drp=1&drpg=2&drps=100'])
    await screen.findByText('Коваленко Іван Петрович')

    // skip is derived from the ACTIVE page size, not the default one.
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        date_from: '2026-09-01',
        date_to: '2026-09-07',
        hide_worked_today: true,
        hide_worked: true,
        hide_paid: true,
        skip: 100,
        limit: 100,
      })
    )
    const [dateFrom, dateTo] = dateInputs()
    expect(dateFrom.value).toBe('2026-09-01')
    expect(dateTo.value).toBe('2026-09-07')
    expect(hideWorkedTodayCheckbox()).toBeChecked()
    expect(hideWorkedCheckbox()).toBeChecked()
    expect(hidePaidCheckbox()).toBeChecked()
    expect(allHistoryCheckbox()).not.toBeChecked()
  })

  it('neither consumes nor clobbers the other report tabs’ URL params', async () => {
    // The host page keeps every tab's params in the URL, so this tab renders
    // with the processing (`from`/`dept` — the `d…` spelling a DRains feed
    // collides with first), promises-feed (`prf`/`prw`) and callbacks
    // (`cbf`/`cbw`/`cbpg`) keys present. None of them may leak into this tab's
    // request — and writing this tab's own keys must leave them untouched.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([
      '/?tab=drains&from=2026-03-03&dept=5&prf=2026-02-02&prw=1&cbf=2026-01-01&cbw=1&cbpg=7',
    ])
    await screen.findByText('Коваленко Іван Петрович')

    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect(params.date_from).not.toBe('2026-03-03')
    expect(params.date_from).not.toBe('2026-02-02')
    expect(params.date_from).not.toBe('2026-01-01')
    expect(params.skip).toBe(0)
    expect(params.limit).toBe(50)
    expect('hide_worked_today' in params).toBe(false)
    expect('hide_worked' in params).toBe(false)
    expect('hide_paid' in params).toBe(false)

    // Now write this tab's own state...
    fireEvent.change(dateInputs()[0], { target: { value: '2026-09-05' } })
    await waitFor(() => expect(search()).toContain('drf=2026-09-05'))

    // ...and every foreign key survives verbatim.
    expect(search()).toContain('tab=drains')
    expect(search()).toContain('from=2026-03-03')
    expect(search()).toContain('dept=5')
    expect(search()).toContain('prf=2026-02-02')
    expect(search()).toContain('prw=1')
    expect(search()).toContain('cbf=2026-01-01')
    expect(search()).toContain('cbw=1')
    expect(search()).toContain('cbpg=7')
  })

  it('writes a picked date into the URL and resets the page in the same update', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?drf=2026-09-01&drt=2026-09-07&drpg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    fireEvent.change(dateInputs()[0], { target: { value: '2026-09-05' } })

    // Otherwise the user lands on an offset the new window may not even have.
    await waitFor(() => expect(search()).toContain('drf=2026-09-05'))
    await waitFor(() => expect(search()).not.toContain('drpg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: '2026-09-05', skip: 0 })
      )
    )
  })

  // ==========================================================================
  // The three server-side toggles
  // ==========================================================================

  it.each([
    ['hideWorkedToday', 'drwt', 'hide_worked_today', ['hide_worked', 'hide_paid']],
    ['hideWorked', 'drw', 'hide_worked', ['hide_worked_today', 'hide_paid']],
    ['hidePaid', 'drp', 'hide_paid', ['hide_worked_today', 'hide_worked']],
  ])(
    'refetches with %s on, pins ?%s=1 and leaves the other two alone',
    async (label, urlKey, apiKey, others) => {
      // All three are SERVER-side filters — they must REFETCH, not filter the
      // page client-side (hiding locally would tear holes in a paginated
      // feed), and each reads a DIFFERENT column, so switching one must not
      // drag the others along.
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')
      const firstParams: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
      expect(apiKey in firstParams).toBe(false)

      const checkbox = screen.getByRole('checkbox', { name: `pages.reports.drainsFeed.${label}` })
      expect(checkbox).not.toBeChecked()
      await userEvent.click(checkbox)

      await waitFor(() => expect(search()).toContain(`${urlKey}=1`))
      await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ [apiKey]: true }))

      const lastParams: Record<string, unknown> = { ...mockGetFeed.mock.calls[1][0] }
      for (const other of others) {
        expect(other in lastParams).toBe(false)
      }
      // The mode switch is not a row filter and must not move with them.
      expect(search()).not.toContain('dra=')
    }
  )

  it('carries all three toggles at once when all three are set', async () => {
    // They are independent server-side predicates and stack; a shared link
    // with all three on must send all three.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?drwt=1&drw=1&drp=1'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ hide_worked_today: true, hide_worked: true, hide_paid: true })
    )
    expect(hideWorkedTodayCheckbox()).toBeChecked()
    expect(hideWorkedCheckbox()).toBeChecked()
    expect(hidePaidCheckbox()).toBeChecked()
  })

  it('drops the key and refetches without it when a toggle is cleared', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?drw=1'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(hideWorkedCheckbox()).toBeChecked()
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ hide_worked: true }))

    await userEvent.click(hideWorkedCheckbox())

    // The backend default (off) is the ABSENCE of the key, never a spelled-out
    // `drw=0`: a shared link then carries only choices somebody made.
    await waitFor(() => expect(search()).not.toContain('drw='))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
    const lastParams: Record<string, unknown> = { ...mockGetFeed.mock.calls[1][0] }
    expect('hide_worked' in lastParams).toBe(false)
  })

  it('resets the page when a toggle changes — a filtered feed has different pages', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?drpg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    await userEvent.click(hideWorkedCheckbox())

    // Page 3 of the unfiltered feed almost certainly does not exist afterwards:
    // this toggle alone drops ~90 % of a day's rows BY DESIGN — the toggle and
    // the page reset land as ONE URL update.
    await waitFor(() => expect(search()).toContain('drw=1'))
    await waitFor(() => expect(search()).not.toContain('drpg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ hide_worked: true, skip: 0 })
      )
    )
  })

  // ==========================================================================
  // Window validation — nothing invalid reaches the API
  // ==========================================================================

  it.each([
    ['a day the month does not have', '/?drf=2026-02-31', 0],
    ['a month that does not exist', '/?drt=2026-13-01', 1],
  ])('blocks a hand-edited bound with %s', async (_case, entry, offendingIndex) => {
    // Shape-only validation would let these through: comparisons against NaN
    // are all false and the request would go out with a date the picker itself
    // renders as a different day. The default must NOT silently stand in for
    // the bad value either — the URL would then disagree with the request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(await screen.findByText('pages.reports.drainsFeed.invalidDate')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    const fields = dateInputs()
    expect(fields[offendingIndex]).toHaveAttribute('aria-invalid', 'true')
    expect(fields[1 - offendingIndex]).not.toHaveAttribute('aria-invalid')
    // The offending field shows empty (the message asks to pick a date), not
    // the default silently pretending the URL value was fine.
    expect(fields[offendingIndex].value).toBe('')
    // An unusable bound is NOT reported as a half window on top of it: one
    // typo, one message.
    expect(screen.queryByText('pages.reports.drainsFeed.bothOrNeither')).not.toBeInTheDocument()
  })

  it('blocks an inverted window and recovers once a bound is repicked', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?drf=2026-09-20&drt=2026-09-10'])

    expect(await screen.findByText('pages.reports.drainsFeed.invalidRange')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A pair error stays a standalone alert: neither bound is wrong on its
    // own, so neither field is singled out as invalid.
    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('aria-invalid')
    }

    fireEvent.change(dateInputs()[1], { target: { value: '2026-09-25' } })

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-09-20', date_to: '2026-09-25' })
    )
  })

  it('mirrors the backend’s 366-day cap instead of letting it answer 400', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    // 2026-01-01 → 2027-01-03 is a 367-day difference (368 days inclusive).
    renderTab(['/?drf=2026-01-01&drt=2027-01-03'])

    expect(await screen.findByText('pages.reports.drainsFeed.rangeTooLong')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
  })

  it('lets the widest allowed window — exactly a 366-day difference — through', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    // The cap is on the day DIFFERENCE, so 2026-01-01 → 2027-01-02 (367 days
    // inclusive) is the last window that must still fire a request — pinning
    // the boundary from the allowed side too, or the guard could silently
    // tighten to 365.
    renderTab(['/?drf=2026-01-01&drt=2027-01-02'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(screen.queryByText('pages.reports.drainsFeed.rangeTooLong')).not.toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-01-01', date_to: '2027-01-02' })
    )
  })

  it('bounds neither picker by the other — no min/max on either field', async () => {
    // The page-wide calendar policy of every date pair with a DEFAULTED window
    // (the reasoning is written out in full in SearcherFollowupFeedTab). This
    // is the regression guard: reinstating `min={dateFrom}` on the «по» field
    // fails here.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?drf=2026-09-01&drt=2026-09-07'])
    await screen.findByText('Коваленко Іван Петрович')

    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('data-min')
      expect(field).not.toHaveAttribute('data-max')
    }
  })

  // ==========================================================================
  // Pagination
  // ==========================================================================

  it('pages through the feed with the right skip and keeps the page in the URL', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('3'))

    await waitFor(() => expect(search()).toContain('drpg=3'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: 100, limit: 50 })
      )
    )
  })

  it('heals a stale ?drpg= down to the last page the answer still has', async () => {
    // This feed's historical windows genuinely SHRINK — a client who promises
    // again leaves the window their previous promise sat in — so a bookmarked
    // page outliving its rows is the normal case here, not an edge one.
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 })
      )

    renderTab(['/?drpg=5'])

    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 200 }))
    )
    await waitFor(() => expect(search()).toContain('drpg=2'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 50, limit: 50 }))
    )
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledTimes(2)

    // A dead offset is not a failure — no error branch on the way through.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.drainsFeed.error.retry' })
    ).not.toBeInTheDocument()
  })

  it.each([
    ['a size outside the offered options', '/?drps=999'],
    ['a non-numeric size', '/?drps=abc'],
  ])('falls back to the default limit for %s', async (_case, entry) => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
    // A view preference, not a filter: the value is ignored, not rewritten.
    expect(search()).toContain('drps=')
  })

  // ==========================================================================
  // The table through the tab
  // ==========================================================================

  it('shows the calm empty state (and no pager) for a window without drains', async () => {
    // The default window is a single past day, `hide_worked` alone drops ~90 %
    // of it, and a bookmarked historical window shrinks as clients promise
    // again — HTTP 200 with total 0, not a fault.
    mockGetFeed.mockResolvedValue(makeResponse([], { total: 0, total_pages: 0 }))

    renderTab()

    expect(await screen.findByText('pages.reports.drainsFeed.empty')).toBeInTheDocument()
    // The pager's own label, as the global i18n mock renders it ("Page") — the
    // raw key never reaches the DOM, so querying for it would pass vacuously.
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
  })

  it('renders the money columns and the datetimes of a row through the tab', async () => {
    // Integration: the profile zone read from the auth store must reach the
    // table's formatter, and both money columns must survive the wiring — the
    // gate of the whole report is promised > paid.
    authState.user.timezone = 'Europe/Kyiv'
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('11-09-2026 09:00')).toBeInTheDocument()
    expect(screen.getByText('26-08-2026 09:14')).toBeInTheDocument()
    expect(screen.getByText('1,500.00')).toBeInTheDocument()
    expect(screen.getByText('0.00')).toBeInTheDocument()
    // ...while the last-interaction column stays a bare calendar DAY.
    expect(screen.getByText('10-09-2026')).toBeInTheDocument()
  })

  it('renders the no-department label and the client link through the tab', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow({ department: null })]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    expect(screen.getByText('pages.reports.drainsFeed.columns.noDepartment')).toBeInTheDocument()
    // The internal route built from client_id — never the payload's absolute
    // `link` URL (its backend-configured host defaults to production's).
    expect(
      screen.getByRole('link', { name: 'pages.reports.drainsFeed.openClient' })
    ).toHaveAttribute('href', '/dashboard/clients/84213')
  })

  it('shows the shared loading caption over the skeleton on the first load', async () => {
    // Kanbanboard#100: every report tab shows the same caption card while its
    // first answer is on the way — not the bare skeleton it used to.
    let resolveFirst: (value: DrainsFeedResponse) => void = () => {}
    mockGetFeed.mockImplementationOnce(
      () => new Promise<DrainsFeedResponse>((resolve) => (resolveFirst = resolve))
    )

    renderTab()
    expect(await screen.findByTestId('report-loading-status')).toBeInTheDocument()

    resolveFirst(makeResponse([makeRow()]))
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(screen.queryByTestId('report-loading-status')).not.toBeInTheDocument()
  })

  it('shows the shared loading caption while a new page loads over the old rows', async () => {
    let resolveSecond: (value: DrainsFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<DrainsFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')
    expect(screen.queryByTestId('report-loading-status')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTitle('2'))
    expect(await screen.findByTestId('report-loading-status')).toBeInTheDocument()

    resolveSecond(
      makeResponse([makeRow({ employee_interacted: 'Оновленко Олег' })], {
        total: 130,
        page: 2,
        page_size: 50,
        total_pages: 3,
      })
    )
    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('report-loading-status')).not.toBeInTheDocument()
    )
  })

  it('marks previous rows as busy while a new page is loading', async () => {
    let resolveSecond: (value: DrainsFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<DrainsFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('2'))

    expect(await screen.findByTestId('drains-feed-refreshing')).toBeInTheDocument()
    expect(screen.getByText('Коваленко Іван Петрович')).toBeInTheDocument()

    resolveSecond(
      makeResponse([makeRow({ employee_interacted: 'Оновленко Олег' })], {
        total: 130,
        page: 2,
        page_size: 50,
        total_pages: 3,
      })
    )

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('drains-feed-refreshing')).not.toBeInTheDocument()
    )
  })

  // ==========================================================================
  // The error ladder
  // ==========================================================================

  it('shows a permissions message without a retry button on 403', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(403))

    renderTab()

    expect(await screen.findByText('pages.reports.drainsFeed.forbidden')).toBeInTheDocument()
    // Retrying cannot fix missing permissions.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.drainsFeed.error.retry' })
    ).not.toBeInTheDocument()
  })

  it('shows the backend detail for a 400 validation answer', async () => {
    // The candidate-ceiling refusal is this endpoint's own 400 and is entirely
    // actionable — which is why the server's sentence is shown verbatim.
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, {
        detail:
          'Drains feed: more than the configured maximum of 40000 candidates match; request a narrower date window (date_from/date_to)',
      })
    )

    renderTab()

    expect(await screen.findByText(/more than the configured maximum/)).toBeInTheDocument()
  })

  it('falls back to the localized title for a 400 whose body never arrived', async () => {
    // A proxy that strips the body would otherwise leave axios' own
    // untranslated "Request failed with status code 400" on screen.
    mockGetFeed.mockRejectedValue(makeHttpError(400))

    renderTab()

    expect(await screen.findByText('pages.reports.drainsFeed.error.title')).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      mockGetFeed.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(await screen.findByText('pages.reports.drainsFeed.unavailable')).toBeInTheDocument()
    }
  )

  it('shows the PAYMENT-service 503 detail under the localized message', async () => {
    // The one that matters most on this feed: payments are its ROW GATE, so a
    // payment outage cannot degrade to a partial list — it would publish every
    // candidate as an unpaid drain. Telling that failure from an employee-
    // directory one is the whole reason the detail is rendered here.
    mockGetFeed.mockRejectedValue(
      makeHttpError(503, {
        detail:
          'Payment history (payment-service) is unavailable; the feed cannot be rendered safely',
      })
    )

    renderTab()

    expect(await screen.findByText('pages.reports.drainsFeed.unavailable')).toBeInTheDocument()
    expect(
      screen.getByText(/Payment history \(payment-service\) is unavailable/)
    ).toBeInTheDocument()
  })

  it('shows no detail line for a transient failure that carries no body', async () => {
    // A 502 from a proxy or a dropped connection has nothing to say — the
    // localized sentence must stand alone rather than gain axios' own text.
    mockGetFeed.mockRejectedValue(makeHttpError(502))

    renderTab()

    expect(await screen.findByText('pages.reports.drainsFeed.unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it('treats network failures as transient unavailability, with no detail line', async () => {
    mockGetFeed.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(await screen.findByText('pages.reports.drainsFeed.unavailable')).toBeInTheDocument()
    expect(screen.queryByText('ERR_NETWORK')).not.toBeInTheDocument()
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetFeed
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.drainsFeed.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.drainsFeed.error.retry' })
    )

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
  })

  it('does not crash on an unexpected 422 from a hand-crafted request', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(422, { detail: [{ msg: 'bad' }] }))

    renderTab()

    expect(await screen.findByText('pages.reports.drainsFeed.error.title')).toBeInTheDocument()
  })
})

describe('DrainsFeed locale keys', () => {
  // The tab renders KEYS in tests (react-i18next is mocked globally), so
  // nothing above would notice a key added to one locale only — these read the
  // actual translation files.
  const uk = ukCommon.pages.reports.drainsFeed
  const en = enCommon.pages.reports.drainsFeed

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

  it('names the tab in both locales', () => {
    expect(ukCommon.pages.reports.tabs['drains']).toBe('Зливи')
    expect(enCommon.pages.reports.tabs['drains']).toBe('Drains')
  })

  it('names the three toggles distinctly — Techno-Finance calls two of them «отработанные»', () => {
    // The source UI labels `hide_worked_today` and `hide_worked` almost
    // identically («Скрыть отработанных сегодня» / «Скрыть отработанных»),
    // which is exactly why they read as one switch there; here the second one
    // hides ~90 % of a day's rows and the first a handful, so the labels must
    // not collapse back into each other. The same confusable pair was raised
    // on the callbacks feed (review of #172) and the rule is copied from it.
    const labels = [
      [uk.hideWorkedToday, uk.hideWorked, uk.hidePaid],
      [en.hideWorkedToday, en.hideWorked, en.hidePaid],
    ]
    for (const [workedToday, worked, paid] of labels) {
      expect(new Set([workedToday, worked, paid]).size).toBe(3)

      // `not.toBe` alone passes on «Приховати відпрацьованих сьогодні» vs
      // «Приховати відпрацьовані» — different strings that still read as the
      // same switch when skimmed. The labels must differ from their FIRST
      // words on, so require the leading two words to differ.
      const lead = (label: string) => label.split(/\s+/).slice(0, 2).join(' ')
      expect(new Set([lead(workedToday), lead(worked), lead(paid)]).size).toBe(3)
    }
  })

  it('keeps the all-history switch worded as a MODE, not as another hide filter', () => {
    // It sits next to three checkboxes that all start with «Приховати» / "Hide"
    // and does something categorically different — it changes which report is
    // requested. A label that joined the "hide…" family would read as a fourth
    // row filter.
    expect(uk.allHistory).not.toMatch(/^Приховати/)
    expect(en.allHistory).not.toMatch(/^Hide/i)
  })
})
