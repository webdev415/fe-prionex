import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import { CallbacksFeedTab } from '../CallbacksFeedTab'
import { getCallbacksFeed } from '../../api/callbacksFeedApi'
import type { CallbacksFeedResponse, CallbacksFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/callbacksFeedApi', () => ({
  getCallbacksFeed: vi.fn(),
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
// component (onChange receives a Date or null), mirroring the sibling feed
// tab tests (promisesFeed, searcherFollowup). `error` follows the real
// contract — a role="alert" paragraph plus aria-invalid/aria-describedby on
// the field — and `min`/`max` are surfaced as data attributes ONLY when the
// tab actually passes them, so "neither picker bounds the other" stays an
// assertable fact.
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

const mockGetFeed = vi.mocked(getCallbacksFeed)

function makeRow(overrides: Partial<CallbacksFeedRow> = {}): CallbacksFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    // A fortnight older than the scheduled call — the window's axis is the
    // callback, not the conversation that produced it.
    interaction_date: '2026-08-26T06:14:03Z',
    interaction_type: 'Передзвонити',
    promise_date: '2026-09-09T06:00:00Z',
    employee_interacted: 'Коваленко Іван Петрович',
    employee_responsible: 'Мельник Ольга Ігорівна',
    link: 'https://crm-prionex.online/dashboard/clients/84213',
    last_interaction_date: '2026-09-08',
    last_result: '',
    department: 'Стягнення',
    group_name: 'Полка',
    ...overrides,
  }
}

function makeResponse(
  rows: CallbacksFeedRow[],
  overrides: Partial<CallbacksFeedResponse> = {}
): CallbacksFeedResponse {
  return {
    project_id: 1,
    date_from: '2026-09-09',
    date_to: '2026-09-09',
    hide_called_today: false,
    hide_worked: false,
    rows,
    total: rows.length,
    page: 1,
    page_size: 50,
    total_pages: rows.length > 0 ? 1 : 0,
    generated_at: '2026-09-09T09:00:00Z',
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
        <CallbacksFeedTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const search = () => screen.getByTestId('location-search').textContent ?? ''
const hideCalledTodayCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.callbacksFeed.hideCalledToday' })
const hideWorkedCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.callbacksFeed.hideWorked' })

/**
 * Today's calendar day in an IANA zone, computed independently of the
 * component's own helper (en-CA renders as YYYY-MM-DD) — asserting through
 * `getDateStringInTimezone` itself would be circular.
 */
function ymdIn(timeZone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** A day `days` away from now in an IANA zone (negative for the past). */
function ymdInAfterDays(timeZone: string, days: number): string {
  return ymdIn(timeZone, new Date(Date.now() + days * 86_400_000))
}

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
})

afterEach(() => {
  // Several tests below fake Date (only Date — real timers keep waitFor,
  // React Query and userEvent flowing); a no-op for the rest.
  vi.useRealTimers()
})

describe('CallbacksFeedTab', () => {
  // ==========================================================================
  // The window
  // ==========================================================================

  it('defaults the window to today–today in the PROFILE timezone and sends it explicitly', async () => {
    // UTC+14 — almost always a different calendar day than the test runner's
    // clock, so a component that resolved "today" browser-locally would fail.
    authState.user.timezone = 'Pacific/Kiritimati'
    const kiritimatiToday = ymdIn('Pacific/Kiritimati')
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()

    // Both bounds go out even though the backend defaults them to today
    // itself — the fields and the request must never disagree, and the
    // profile timezone travels along so the server cuts the same day.
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith({
      project_id: 1,
      date_from: kiritimatiToday,
      date_to: kiritimatiToday,
      skip: 0,
      limit: 50,
      timezone: 'Pacific/Kiritimati',
    })

    // The fields show the default...
    const [dateFrom, dateTo] = dateInputs()
    expect(dateFrom.value).toBe(kiritimatiToday)
    expect(dateTo.value).toBe(kiritimatiToday)
    // ...but an auto-derived value is never pinned into the URL: a shared
    // link would otherwise freeze "today" to the day the link was made. The
    // backend defaults (toggles off) stay absent too.
    expect(search()).not.toContain('cbf=')
    expect(search()).not.toContain('cbt=')
    expect(search()).not.toContain('cbc=')
    expect(search()).not.toContain('cbw=')
  })

  it('falls back to the BROWSER timezone for a profile without one — the param always goes out', async () => {
    // An omitted param would make the backend cut the window by UTC while the
    // table renders the datetimes browser-locally — a near-midnight callback
    // would sit in one day's plan but show the next day's time in its cell.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    // What is pinned: the KEY is present and holds the browser zone (the
    // vitest config defaults TZ to UTC, so this resolves deterministically).
    expect(params.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    // The default still goes out as an explicit pair.
    expect(params.date_from).toBe(params.date_to)
  })

  describe('midnight rollover — the default window lives in state and re-resolves on focus', () => {
    // Only Date is faked: real timers keep waitFor / React Query / userEvent
    // flowing, while setSystemTime moves what "now" (and thus "today") is.
    // React Query v5's own focus refetching listens to `visibilitychange`,
    // not `focus`, so the dispatched focus events below reach ONLY the tab's
    // listener — every refetch asserted here is the component's doing.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      authState.user.timezone = 'Europe/Kyiv'
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    /** Lets any would-be re-render/refetch land before asserting nothing did. */
    const flush = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

    it('refires the default window with the new day on a focus after midnight', async () => {
      // Mounted just AFTER Kyiv midnight, while UTC is still on the previous
      // day (UTC+3 in September): 22:30Z Sep 8 = 01:30 Sep 9 in Kyiv. The
      // literal '2026-09-09' below is what tells the profile-timezone
      // resolution from a browser(UTC)-local one — the latter would resolve
      // "today" to '2026-09-08' and fail here.
      vi.setSystemTime(new Date('2026-09-08T22:30:00Z')) // 01:30 Sep 9 Kyiv
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-09-09', date_to: '2026-09-09' })
      )

      // ...left open across the NEXT Kyiv midnight, and focused again the
      // following morning. A render read of the wall clock would keep
      // YESTERDAY's call plan here until some unrelated re-render happened to
      // recompute it.
      vi.setSystemTime(new Date('2026-09-10T05:00:00Z')) // 08:00 Sep 10 Kyiv
      fireEvent(window, new Event('focus'))

      await waitFor(() =>
        expect(mockGetFeed).toHaveBeenLastCalledWith(
          expect.objectContaining({ date_from: '2026-09-10', date_to: '2026-09-10' })
        )
      )
      expect(mockGetFeed).toHaveBeenCalledTimes(2)
      // The fields follow the rolled-over default...
      const [dateFrom, dateTo] = dateInputs()
      expect(dateFrom.value).toBe('2026-09-10')
      expect(dateTo.value).toBe('2026-09-10')
      // ...and an auto-derived value still never lands in the URL.
      expect(search()).not.toContain('cbf=')
      expect(search()).not.toContain('cbt=')
    })

    it('treats a same-day focus as a no-op — no extra request', async () => {
      vi.setSystemTime(new Date('2026-09-09T09:00:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')
      expect(mockGetFeed).toHaveBeenCalledTimes(1)

      // Hours later, but the same Kyiv calendar day: the functional update
      // hands back the previous value, so nothing re-renders and the query
      // key never moves.
      vi.setSystemTime(new Date('2026-09-09T15:00:00Z'))
      fireEvent(window, new Event('focus'))

      await flush()
      expect(mockGetFeed).toHaveBeenCalledTimes(1)
    })

    it('leaves a user-picked window alone when the day rolls over', async () => {
      vi.setSystemTime(new Date('2026-09-08T20:55:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?cbf=2026-06-01&cbt=2026-06-30'])
      await screen.findByText('Коваленко Іван Петрович')

      vi.setSystemTime(new Date('2026-09-09T05:00:00Z'))
      fireEvent(window, new Event('focus'))

      await flush()
      // `today` only backs the DEFAULT window: with both bounds picked in the
      // URL, the rollover neither refetches nor moves what is sent or shown.
      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-06-01', date_to: '2026-06-30' })
      )
      const [dateFrom, dateTo] = dateInputs()
      expect(dateFrom.value).toBe('2026-06-01')
      expect(dateTo.value).toBe('2026-06-30')
    })
  })

  it('round-trips every filter and the page window through the URL (?cbf=&cbt=&cbc=&cbw=&cbpg=&cbps=)', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 2, page_size: 100, total_pages: 3 })
    )

    renderTab(['/?cbf=2026-09-01&cbt=2026-09-07&cbc=1&cbw=1&cbpg=2&cbps=100'])
    await screen.findByText('Коваленко Іван Петрович')

    // skip is derived from the ACTIVE page size, not the default one.
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        date_from: '2026-09-01',
        date_to: '2026-09-07',
        hide_called_today: true,
        hide_worked: true,
        skip: 100,
        limit: 100,
      })
    )
    const [dateFrom, dateTo] = dateInputs()
    expect(dateFrom.value).toBe('2026-09-01')
    expect(dateTo.value).toBe('2026-09-07')
    expect(hideCalledTodayCheckbox()).toBeChecked()
    expect(hideWorkedCheckbox()).toBeChecked()
  })

  it.each([
    [
      'a lower bound (?cbf=) only',
      // Both bounds are RELATIVE to today: this feed caps the window at a
      // 366-day difference, so a fixed past day would eventually trip the cap
      // guard instead of exercising the half-window fill.
      (bounds: { past: string; today: string; future: string }) => ({
        entry: `/?cbf=${bounds.past}`,
        expected: { date_from: bounds.past, date_to: bounds.today },
      }),
    ],
    [
      'an upper bound (?cbt=) only',
      // A future day — legitimate for a CALL PLAN (the schedule runs weeks
      // ahead), and the defaulted lower bound is today, so a past-only upper
      // bound would (correctly) trip the inverted-range guard instead.
      (bounds: { past: string; today: string; future: string }) => ({
        entry: `/?cbt=${bounds.future}`,
        expected: { date_from: bounds.today, date_to: bounds.future },
      }),
    ],
  ])(
    'fills the absent side of a link carrying %s with today in the profile timezone',
    async (_case, build) => {
      // The backend accepts both bounds or neither (half a window answers 400),
      // so an absent bound means "today", not "no bound" — the pair must go out
      // whole even when a shared link carries only one side.
      authState.user.timezone = 'Pacific/Kiritimati'
      const { entry, expected } = build({
        past: ymdInAfterDays('Pacific/Kiritimati', -30),
        today: ymdIn('Pacific/Kiritimati'),
        future: ymdInAfterDays('Pacific/Kiritimati', 30),
      })
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab([entry])
      await screen.findByText('Коваленко Іван Петрович')

      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining(expected))
    }
  )

  it('neither consumes nor clobbers the other report tabs’ URL params', async () => {
    // The host page keeps every tab's params in the URL, so this tab renders
    // with the processing (`from`), verification (`cf`/`ct`) and promises-feed
    // (`prf`/`prt`/`prw`/`prpg`/`prps`) keys present — `cf`/`ct` being exactly
    // the spellings a CallbacKs feed would have reached for, and the promises
    // feed being the set this one was copied from. None of them may leak into
    // this tab's request — and writing this tab's own keys must leave them
    // untouched.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([
      '/?tab=callbacks&from=2026-03-03&cf=2026-01-01&ct=2026-01-31&prf=2026-02-02&prt=2026-02-28&prw=1&prpg=7&prps=100',
    ])
    await screen.findByText('Коваленко Іван Петрович')

    // Foreign date keys are not this tab's window (defaults hold), the sibling
    // feed's prpg/prps are not this tab's paging, and its prw is not this
    // tab's toggle.
    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect(params.date_from).not.toBe('2026-03-03')
    expect(params.date_from).not.toBe('2026-01-01')
    expect(params.date_from).not.toBe('2026-02-02')
    expect(params.skip).toBe(0)
    expect(params.limit).toBe(50)
    expect('hide_called_today' in params).toBe(false)
    expect('hide_worked' in params).toBe(false)

    // Now write this tab's own state...
    fireEvent.change(dateInputs()[0], { target: { value: '2026-09-05' } })
    await waitFor(() => expect(search()).toContain('cbf=2026-09-05'))

    // ...and every foreign key survives verbatim.
    expect(search()).toContain('tab=callbacks')
    expect(search()).toContain('from=2026-03-03')
    expect(search()).toContain('cf=2026-01-01')
    expect(search()).toContain('ct=2026-01-31')
    expect(search()).toContain('prf=2026-02-02')
    expect(search()).toContain('prt=2026-02-28')
    expect(search()).toContain('prw=1')
    expect(search()).toContain('prpg=7')
    expect(search()).toContain('prps=100')
  })

  it('writes a picked date into the URL and resets the page in the same update', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?cbpg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    fireEvent.change(dateInputs()[0], { target: { value: '2026-09-05' } })

    // Otherwise the user lands on an offset the new window may not even have.
    await waitFor(() => expect(search()).toContain('cbf=2026-09-05'))
    await waitFor(() => expect(search()).not.toContain('cbpg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: '2026-09-05', skip: 0 })
      )
    )
  })

  // ==========================================================================
  // The two server-side toggles
  // ==========================================================================

  it('refetches with hide_called_today: true when «Приховати дзвонених сьогодні» is set, and pins ?cbc=1', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')
    // The backend default (off) sends NO key at all.
    const firstParams: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect('hide_called_today' in firstParams).toBe(false)
    expect(hideCalledTodayCheckbox()).not.toBeChecked()

    await userEvent.click(hideCalledTodayCheckbox())

    await waitFor(() => expect(search()).toContain('cbc=1'))
    // A SERVER-side filter — it must REFETCH, not filter the page client-side
    // (hiding locally would tear holes in a paginated feed).
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
    expect(mockGetFeed).toHaveBeenLastCalledWith(
      expect.objectContaining({ hide_called_today: true })
    )
    // The other toggle is untouched — they are NOT two spellings of one idea
    // (on a past window one drops 3 % of the rows and the other 74 %).
    expect(search()).not.toContain('cbw=')
    const lastParams: Record<string, unknown> = { ...mockGetFeed.mock.calls[1][0] }
    expect('hide_worked' in lastParams).toBe(false)
  })

  it('refetches with hide_worked: true when «Приховати відпрацьованих» is set, and pins ?cbw=1', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')
    const firstParams: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect('hide_worked' in firstParams).toBe(false)
    expect(hideWorkedCheckbox()).not.toBeChecked()

    await userEvent.click(hideWorkedCheckbox())

    await waitFor(() => expect(search()).toContain('cbw=1'))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ hide_worked: true }))
    expect(search()).not.toContain('cbc=')
    const lastParams: Record<string, unknown> = { ...mockGetFeed.mock.calls[1][0] }
    expect('hide_called_today' in lastParams).toBe(false)
  })

  it('carries both toggles at once when both are set', async () => {
    // They are independent server-side predicates and stack; a shared link
    // with both on must send both.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?cbc=1&cbw=1'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ hide_called_today: true, hide_worked: true })
    )
    expect(hideCalledTodayCheckbox()).toBeChecked()
    expect(hideWorkedCheckbox()).toBeChecked()
  })

  it('drops the key and refetches without it when a toggle is cleared', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?cbw=1'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(hideWorkedCheckbox()).toBeChecked()
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ hide_worked: true }))

    await userEvent.click(hideWorkedCheckbox())

    // The backend default (off) is the ABSENCE of the key, never a spelled-out
    // `cbw=0`: a shared link then carries only choices somebody made.
    await waitFor(() => expect(search()).not.toContain('cbw='))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
    const lastParams: Record<string, unknown> = { ...mockGetFeed.mock.calls[1][0] }
    expect('hide_worked' in lastParams).toBe(false)
  })

  it('resets the page when a toggle changes — a filtered feed has different pages', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?cbpg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    await userEvent.click(hideWorkedCheckbox())

    // Page 3 of the unfiltered feed may well not exist once the worked rows
    // are dropped (three quarters of a past window) — the toggle and the page
    // reset land as ONE URL update.
    await waitFor(() => expect(search()).toContain('cbw=1'))
    await waitFor(() => expect(search()).not.toContain('cbpg='))
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
    ['a day the month does not have', '/?cbf=2026-02-31', 0],
    ['a month that does not exist', '/?cbt=2026-13-01', 1],
  ])('blocks a hand-edited bound with %s', async (_case, entry, offendingIndex) => {
    // Shape-only validation would let these through: comparisons against NaN
    // are all false and the request would go out with a date the picker itself
    // renders as a different day. The default must NOT silently stand in for
    // the bad value either — the URL would then disagree with the request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(await screen.findByText('pages.reports.callbacksFeed.invalidDate')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A single-field error rides that field: only the bound holding the bad
    // value is marked, and its message is reachable from the field itself.
    const fields = dateInputs()
    expect(fields[offendingIndex]).toHaveAttribute('aria-invalid', 'true')
    expect(fields[1 - offendingIndex]).not.toHaveAttribute('aria-invalid')
    const describedBy = fields[offendingIndex].getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'pages.reports.callbacksFeed.invalidDate'
    )
    // The offending field shows empty (the message asks to pick a date), not
    // the default silently pretending the URL value was fine.
    expect(fields[offendingIndex].value).toBe('')
  })

  it('blocks an inverted window and recovers once a bound is repicked', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?cbf=2026-09-20&cbt=2026-09-10'])

    expect(await screen.findByText('pages.reports.callbacksFeed.invalidRange')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A pair error stays a standalone alert: neither bound is wrong on its
    // own, so neither field is singled out as invalid.
    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('aria-invalid')
    }

    // Repicking the upper bound past the lower one makes the pair valid again.
    fireEvent.change(dateInputs()[1], { target: { value: '2026-09-25' } })

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-09-20', date_to: '2026-09-25' })
    )
  })

  it('mirrors the backend’s 366-day cap instead of letting it answer 400', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    // 2026-01-01 → 2027-01-03 is a 367-day difference (368 days inclusive).
    renderTab(['/?cbf=2026-01-01&cbt=2027-01-03'])

    expect(await screen.findByText('pages.reports.callbacksFeed.rangeTooLong')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
  })

  it('lets the widest allowed window — exactly a 366-day difference — through', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    // The cap is on the day DIFFERENCE, so 2026-01-01 → 2027-01-02 (367 days
    // inclusive) is the last window that must still fire a request — pinning
    // the boundary from the allowed side too, or the guard could silently
    // tighten to 365.
    renderTab(['/?cbf=2026-01-01&cbt=2027-01-02'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(screen.queryByText('pages.reports.callbacksFeed.rangeTooLong')).not.toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-01-01', date_to: '2027-01-02' })
    )
  })

  it('bounds neither picker by the other — no min/max on either field', async () => {
    // The page-wide calendar policy of every date pair with a DEFAULTED
    // window (the reasoning is written out in full in SearcherFollowupFeedTab:
    // a mutual bound imposes an ORDER nothing on screen states). This is the
    // regression guard: reinstating `min={dateFrom}` on the «по» field fails
    // here.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?cbf=2026-09-01&cbt=2026-09-07'])
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

    await waitFor(() => expect(search()).toContain('cbpg=3'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: 100, limit: 50 })
      )
    )
  })

  it.each([
    ['a size outside the offered options', '/?cbps=999'],
    ['a non-numeric size', '/?cbps=abc'],
  ])('falls back to the default limit for %s', async (_case, entry) => {
    // 999 would also break the backend's `limit <= 500`. A page size is a view
    // preference, not a filter: an unusable one is ignored silently (no hint,
    // no rewrite of the URL) rather than blocking the request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
    expect(search()).toContain('cbps=')
  })

  it('falls back to page 1 for a ?cbpg= whose offset would overflow the int32 skip cap', async () => {
    // (100000000 - 1) * 50 ≈ 5e9 — past the backend's `skip <= 2147483647`, so
    // the request could only come back 422. Same silent fallback as a bad size.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?cbpg=100000000'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }))
    // A view preference, not a filter: the value is ignored, not rewritten.
    expect(search()).toContain('cbpg=100000000')
  })

  it('heals a stale ?cbpg= down to the last page the answer still has', async () => {
    // A shared link outlives the rows it pointed at: `hide_worked` on a past
    // window drains three quarters of the feed while `?cbpg=5` stayed in the
    // URL.
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 })
      )

    renderTab(['/?cbpg=5'])

    // The page count is only known from an answer, so the stale offset does go
    // out once — but exactly once, and never again after the URL self-heals.
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 200 }))
    )
    await waitFor(() => expect(search()).toContain('cbpg=2'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 50, limit: 50 }))
    )
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledTimes(2)

    // A dead offset is not a failure — no error branch on the way through.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.callbacksFeed.error.retry' })
    ).not.toBeInTheDocument()
  })

  // ==========================================================================
  // The table through the tab
  // ==========================================================================

  it('shows the calm empty state (and no pager) for a window without callbacks', async () => {
    // A Sunday holds a few dozen calls against a weekday's 1400, and
    // `hide_worked` can drain a past day — HTTP 200 with total 0, not a fault.
    mockGetFeed.mockResolvedValue(makeResponse([], { total: 0, total_pages: 0 }))

    renderTab()

    expect(await screen.findByText('pages.reports.callbacksFeed.empty')).toBeInTheDocument()
    // The pager's own label, as the global i18n mock renders it ("Page") — the
    // raw key never reaches the DOM, so querying for it would pass vacuously.
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders the datetimes of a row with date AND time in the profile timezone', async () => {
    // Integration through the tab: the profile zone read from the auth store
    // must reach the table's formatter. 06:00 UTC = 09:00 Kyiv summer time —
    // the typical morning callback slot, which a date-only rendering would
    // erase.
    authState.user.timezone = 'Europe/Kyiv'
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('09-09-2026 09:00')).toBeInTheDocument()
    expect(screen.getByText('26-08-2026 09:14')).toBeInTheDocument()
    // ...while the last-interaction column stays a bare calendar DAY.
    expect(screen.getByText('08-09-2026')).toBeInTheDocument()
  })

  it('renders the no-department label and the client link through the tab', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow({ department: null })]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    expect(screen.getByText('pages.reports.callbacksFeed.columns.noDepartment')).toBeInTheDocument()
    // The internal route built from client_id — never the payload's absolute
    // `link` URL (its backend-configured host defaults to production's).
    expect(
      screen.getByRole('link', { name: 'pages.reports.callbacksFeed.openClient' })
    ).toHaveAttribute('href', '/dashboard/clients/84213')
  })

  it('marks previous rows as busy while a new page is loading', async () => {
    let resolveSecond: (value: CallbacksFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<CallbacksFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('2'))

    // keepPreviousData shows the OLD page's rows while the new one loads —
    // they must not look final, hence the busy overlay over the stale rows.
    expect(await screen.findByTestId('callbacks-feed-refreshing')).toBeInTheDocument()
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
      expect(screen.queryByTestId('callbacks-feed-refreshing')).not.toBeInTheDocument()
    )
  })

  // ==========================================================================
  // The error ladder
  // ==========================================================================

  it('shows a permissions message without a retry button on 403', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(403))

    renderTab()

    expect(await screen.findByText('pages.reports.callbacksFeed.forbidden')).toBeInTheDocument()
    // Retrying cannot fix missing permissions.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.callbacksFeed.error.retry' })
    ).not.toBeInTheDocument()
  })

  it('shows the backend detail for a 400 validation answer', async () => {
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, { detail: 'Unknown IANA timezone: Mars/Olympus' })
    )

    renderTab()

    expect(await screen.findByText('Unknown IANA timezone: Mars/Olympus')).toBeInTheDocument()
  })

  it('falls back to the localized title for a 400 whose body never arrived', async () => {
    // A proxy that strips the body would otherwise leave axios' own
    // untranslated "Request failed with status code 400" on screen.
    mockGetFeed.mockRejectedValue(makeHttpError(400))

    renderTab()

    expect(await screen.findByText('pages.reports.callbacksFeed.error.title')).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      // 503 is what the endpoint answers when the auth-service org directory
      // is down or the statement timeout fires — never a partial feed: a
      // silently missing department would file the callback under the wrong
      // team.
      mockGetFeed.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(await screen.findByText('pages.reports.callbacksFeed.unavailable')).toBeInTheDocument()
    }
  )

  it('shows the 503 detail under the localized unavailability message', async () => {
    // The backend words its 503s distinctly on purpose (which dependency
    // failed); the server's own sentence stays visible UNDER the localized
    // one, never instead of it.
    mockGetFeed.mockRejectedValue(
      makeHttpError(503, { detail: 'Employee directory (auth-service) is unavailable' })
    )

    renderTab()

    expect(await screen.findByText('pages.reports.callbacksFeed.unavailable')).toBeInTheDocument()
    expect(screen.getByText('Employee directory (auth-service) is unavailable')).toBeInTheDocument()
  })

  it('shows no detail line for a transient failure that carries no body', async () => {
    // A 502 from a proxy or a dropped connection has nothing to say — the
    // localized sentence must stand alone rather than gain axios' own text.
    mockGetFeed.mockRejectedValue(makeHttpError(502))

    renderTab()

    expect(await screen.findByText('pages.reports.callbacksFeed.unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it('treats network failures as transient unavailability, with no detail line', async () => {
    mockGetFeed.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(await screen.findByText('pages.reports.callbacksFeed.unavailable')).toBeInTheDocument()
    // A dropped connection carries no body — there is no server sentence to
    // show, and axios' own code must not leak under the message.
    expect(screen.queryByText('ERR_NETWORK')).not.toBeInTheDocument()
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetFeed
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.callbacksFeed.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.callbacksFeed.error.retry' })
    )

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
  })

  it('does not crash on an unexpected 422 from a hand-crafted request', async () => {
    // Unreachable through the UI (the inputs are constrained), but it must
    // land in the generic error branch instead of breaking the tab.
    mockGetFeed.mockRejectedValue(makeHttpError(422, { detail: [{ msg: 'bad' }] }))

    renderTab()

    expect(await screen.findByText('pages.reports.callbacksFeed.error.title')).toBeInTheDocument()
  })
})

describe('CallbacksFeed locale keys', () => {
  // The tab renders KEYS in tests (react-i18next is mocked globally), so
  // nothing above would notice a key added to one locale only — these read the
  // actual translation files.
  const uk = ukCommon.pages.reports.callbacksFeed
  const en = enCommon.pages.reports.callbacksFeed

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
    expect(ukCommon.pages.reports.tabs['callbacks']).toBe('Перезвони')
    expect(enCommon.pages.reports.tabs['callbacks']).toBe('Callbacks')
  })

  it('heads the last-interaction column «Дата останнього ЦД», not «останній дзвінок»', () => {
    // The card's column is named `last_call_date` and it is NOT a telephony
    // call — Techno-Finance renamed it on their side and this migration keeps
    // the corrected wording. A "restore the card's name" tidy-up would put a
    // factual error back on screen.
    expect(uk.columns.lastInteractionDate).toBe('Дата останнього ЦД')
    expect(uk.columns.lastInteractionDate).not.toMatch(/дзвінк|дзвінок/i)
  })

  it('names the two toggles distinctly — Techno-Finance calls both «отработанные»', () => {
    // The source UI labels `hide_called_today` and `hide_worked` almost
    // identically, which is exactly why they read as one idea there; on a past
    // window they differ by an order of magnitude, so the labels here must not
    // collapse back into each other.
    expect(uk.hideCalledToday).not.toBe(uk.hideWorked)
    expect(en.hideCalledToday).not.toBe(en.hideWorked)
  })
})
