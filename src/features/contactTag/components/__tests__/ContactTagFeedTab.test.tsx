import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import { ContactTagFeedTab } from '../ContactTagFeedTab'
import { getContactTagFeed } from '../../api/contactTagFeedApi'
import type { ContactTagFeedResponse, ContactTagFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/contactTagFeedApi', () => ({
  getContactTagFeed: vi.fn(),
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
// keeps the tests focused while still driving value/onChange/onClear like the
// real component (onChange receives a Date or null; onClear is the opt-in "×").
// The "×" name follows the real contract — `clearLabel` when given, otherwise
// the component's hardcoded "Clear" — and is GATED ON A VALUE BEING SET, which
// is load-bearing here rather than cosmetic: the sale-date "×" is this tab's
// only "switch the upper bound off" control while a date is set, and the real
// component renders none when the field is empty. That gate is exactly why the
// `default` state needs a button of its own, and this stub must not
// over-promise a control the shipped component would not show.
//
// `error` is mirrored the same way: the real component renders it as a
// role="alert" paragraph and marks the field aria-invalid/aria-describedby, so
// field-level error wiring is assertable here.
//
// `min`/`max` are surfaced as `data-min`/`data-max` and ONLY when the tab
// actually passes them: the real component forwards them to react-datepicker's
// minDate/maxDate (and adds none of its own), i.e. they are what greys days
// out. Mirroring them as attributes makes the calendar policy an assertable
// fact rather than a comment.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
    onClear,
    clearLabel,
    label,
    error,
    min,
    max,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
    onClear?: () => void
    clearLabel?: string
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
        {/* Same gate as the real component's `showClear` (onClear AND a date
            actually set). */}
        {onClear && value && (
          <button type="button" aria-label={clearLabel ?? 'Clear'} onClick={onClear}>
            ×
          </button>
        )}
        {error && (
          <p id={errorId} role="alert">
            {error}
          </p>
        )}
      </>
    )
  },
}))

// The transient-frame invariant ("Page N of M" with N past M must never reach
// the DOM, not even for the single commit between a stale answer landing and
// the ?kpg= self-heal rewriting the URL) is invisible to polling queries: the
// heal effect has already run by the time any waitFor observer looks. A
// pass-through wrapper records every (currentPage, totalPages) pair the REAL
// Pagination is rendered with, so the healing test can assert over ALL frames,
// including the intermediate one. Every other test renders the genuine
// component untouched.
const paginationFrames = vi.hoisted(() => [] as Array<{ currentPage: number; totalPages: number }>)
vi.mock('@/components/ui/Pagination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/Pagination')>()
  return {
    // Spread first: the module also exports DEFAULT_PAGE_SIZE_OPTIONS, which
    // the paged-feed shell imports to parse `?kps=` against the very set this
    // dropdown offers. Only the component is wrapped.
    ...actual,
    Pagination: (props: import('@/components/ui/Pagination').PaginationProps) => {
      paginationFrames.push({ currentPage: props.currentPage, totalPages: props.totalPages })
      return <actual.Pagination {...props} />
    },
  }
})

const mockGetFeed = vi.mocked(getContactTagFeed)

function makeRow(overrides: Partial<ContactTagFeedRow> = {}): ContactTagFeedRow {
  return {
    client_id: 421395,
    inn: '3210987654',
    tag_code: 'nekontakt',
    tag_name: 'Неконтакт',
    sell_date: '2026-03-11',
    assignment_date: '2026-06-02',
    last_planed_interaction_date: null,
    employee_id: 6971,
    employee_name: 'Коваленко Іван Петрович',
    body_amount: '15000.00',
    last_interaction_date: '2026-08-14',
    department: 'Стягнення',
    group_name: 'Група №3',
    ...overrides,
  }
}

function makeResponse(
  rows: ContactTagFeedRow[],
  overrides: Partial<ContactTagFeedResponse> = {}
): ContactTagFeedResponse {
  return {
    project_id: 1,
    // The response ECHOES the day it was computed for, and the tab reads that
    // echo to know whether the applied-bound hint still speaks for the strip
    // (the default bound is derived from `view_date`). So the fixture echoes
    // the day the tab actually sends when the URL names none; a test driving a
    // different reference day overrides it.
    view_date: tabDefaultViewDate(),
    sell_from: null,
    // The APPLIED upper bound: with no `sell_to` on the wire the backend echoes
    // its own month−4 default, which is what the tab's hint renders.
    sell_to: '2026-04-30',
    rows,
    total: rows.length,
    page: 1,
    page_size: 50,
    total_pages: rows.length > 0 ? 1 : 0,
    generated_at: '2026-08-26T08:31:02.114Z',
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
        <ContactTagFeedTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/** [«Дата перегляду», «Дата продажу з», «Дата продажу по»] */
const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const viewDateInput = () => dateInputs()[0]
const sellFromInput = () => dateInputs()[1]
const sellToInput = () => dateInputs()[2]

const search = () => screen.getByTestId('location-search').textContent ?? ''
/**
 * The URL read as params rather than as a substring — `toContain('kt=')` cannot
 * tell the switched-off `?kt=` from an explicit `?kt=2026-06-30`, and telling
 * those two apart is the point of half this suite.
 */
const urlParams = () => new URLSearchParams(search())

/** The last params object the feed was asked for. */
const lastCall = () => mockGetFeed.mock.calls[mockGetFeed.mock.calls.length - 1][0]

/**
 * The pager's "Page N of M" indicator, read back as [N, M]. The shared
 * Pagination labels resolve through the global i18n mock's map ("Page"/"of"),
 * not to raw keys like this tab's own strings.
 */
const pageIndicator = () =>
  Array.from(screen.getByText('Page').parentElement?.children ?? [])
    .map((element) => element.textContent ?? '')
    .filter((text) => /^\d+$/.test(text))

/** Picks a rows-per-page option in the shared Pagination's (Radix) select. */
async function selectPageSize(size: string) {
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: size }))
}

const subtab = (id: 'all' | 'kontakt' | 'nekontakt', count: number) =>
  screen.getByRole('tab', { name: `pages.reports.contactTag.subtabs.${id} (${count})` })

/**
 * Today's calendar day in an IANA zone, computed independently of the
 * component's own helper (en-CA renders as YYYY-MM-DD) — asserting through
 * `getDateStringInTimezone` itself would be circular.
 */
function ymdIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * The reference day the tab sends when the URL names none — "today" in the
 * PROFILE timezone, or the browser's own calendar day when the profile carries
 * none (the tab's fallback). Computed here rather than read off the component
 * so the fixtures can echo it the way the backend does.
 */
function tabDefaultViewDate(): string {
  const timezone = authState.user.timezone
  if (timezone) return ymdIn(timezone)
  const now = new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
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
  paginationFrames.length = 0
  authState.user.timezone = null
})

describe('ContactTagFeedTab — the required view date', () => {
  it('defaults it to today in the PROFILE timezone and always sends it', async () => {
    // UTC+14 — almost always a different calendar day than the test runner's
    // clock, so a component that resolved "today" browser-locally would fail.
    authState.user.timezone = 'Pacific/Kiritimati'
    const kiritimatiToday = ymdIn('Pacific/Kiritimati')
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()

    // `view_date` is REQUIRED by the contract — the backend has no default for
    // it, so the tab sends the day it shows.
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(lastCall()).toEqual({
      project_id: 1,
      view_date: kiritimatiToday,
      skip: 0,
      limit: 50,
      timezone: 'Pacific/Kiritimati',
    })

    // The field shows the default...
    expect(viewDateInput().value).toBe(kiritimatiToday)
    // ...but an auto-derived value is never pinned into the URL: a shared link
    // would otherwise freeze "today" to the day the link was made.
    expect(urlParams().has('kd')).toBe(false)
  })

  it('omits the timezone param for a profile without one (backend defaults to UTC)', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    expect('timezone' in lastCall()).toBe(false)
    expect(lastCall().view_date).toBeTruthy()
  })

  it('sends a picked view date and writes it to the URL, resetting the page', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?kpg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(lastCall().skip).toBe(100)

    fireEvent.change(viewDateInput(), { target: { value: '2026-08-05' } })

    // A different reference day is a different feed — the old offset may not
    // even exist in it.
    await waitFor(() => expect(urlParams().get('kd')).toBe('2026-08-05'))
    await waitFor(() => expect(urlParams().has('kpg')).toBe(false))
    await waitFor(() => expect(lastCall()).toMatchObject({ view_date: '2026-08-05', skip: 0 }))
  })

  it.each([
    ['a day the month does not have', '/?kd=2026-02-31'],
    ['a month that does not exist', '/?kd=2026-13-01'],
  ])('blocks a hand-edited view date with %s', async (_case, entry) => {
    // Shape-only validation would let these through: comparisons against NaN
    // are all false and the request would go out with a date the picker itself
    // renders as a different day. The default must NOT silently stand in for
    // the bad value either — the URL would then disagree with the request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(await screen.findByText('pages.reports.contactTag.invalidViewDate')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A single-field error rides that field, and only that field.
    expect(viewDateInput()).toHaveAttribute('aria-invalid', 'true')
    expect(sellFromInput()).not.toHaveAttribute('aria-invalid')
    expect(sellToInput()).not.toHaveAttribute('aria-invalid')
    const describedBy = viewDateInput().getAttribute('aria-describedby')
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'pages.reports.contactTag.invalidViewDate'
    )
    // The offending field shows empty (the message asks to pick a date), not
    // the default silently pretending the URL value was fine.
    expect(viewDateInput().value).toBe('')
  })

  it('blocks an EMPTY ?kd= rather than quietly answering for today', async () => {
    // `?kd=` is a key that states no day — a truncated link, a half-edited one,
    // a picker cleared by hand in a URL bar. The reference day has no "unset"
    // state (the thresholds and the promise gate are measured against it), so
    // folding empty into absent — which is what the SHARED bound reader does,
    // rightly, for every optional bound on this page — would answer for TODAY
    // under a URL naming no day at all, with nothing on screen to distrust.
    // Same treatment as 2026-02-31 instead: hint, empty field, no request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?kd='])

    expect(await screen.findByText('pages.reports.contactTag.invalidViewDate')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
    expect(viewDateInput()).toHaveAttribute('aria-invalid', 'true')
    expect(viewDateInput().value).toBe('')
    // ...and the URL is left saying what it said: the tab does not rewrite a
    // deep link behind the operator's back.
    expect(urlParams().get('kd')).toBe('')
  })

  it('has no "×" — the reference day is mandatory, so an empty one is not a state', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?kd=2026-08-05&kf=2026-01-01&kt=2026-06-30'])
    await screen.findByText('Коваленко Іван Петрович')

    // The two sale-date fields DO carry one (an optional bound can be removed
    // or switched off); the reference day must not — so exactly two "×" buttons
    // exist here, and neither of them is the stub's unnamed default.
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'pages.reports.contactTag.clearSellFrom' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'pages.reports.contactTag.clearSellTo' })
    ).toBeInTheDocument()
    expect(screen.getAllByText('×')).toHaveLength(2)
  })

  describe('midnight rollover — the default lives in state and re-resolves on focus', () => {
    // Only Date is faked: real timers keep waitFor / React Query / userEvent
    // flowing, while setSystemTime moves what "now" (and thus "today") is.
    // React Query v5's own focus refetching listens to `visibilitychange`, not
    // `focus`, so the dispatched focus events below reach ONLY the tab's
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

    it('refires with the new day on a focus after midnight', async () => {
      // Mounted just before Kyiv midnight (UTC+3 in August)...
      vi.setSystemTime(new Date('2026-08-14T20:55:00Z')) // 23:55 Aug 14 Kyiv
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')
      expect(lastCall().view_date).toBe('2026-08-14')

      // ...left open across it, and focused again the next morning. A render
      // read of the wall clock would keep YESTERDAY's reference day here until
      // some unrelated re-render happened to recompute it — and the thresholds
      // are measured against this very date, so the whole feed would be stale.
      vi.setSystemTime(new Date('2026-08-15T05:00:00Z')) // 08:00 Aug 15 Kyiv
      fireEvent(window, new Event('focus'))

      await waitFor(() => expect(lastCall().view_date).toBe('2026-08-15'))
      expect(mockGetFeed).toHaveBeenCalledTimes(2)
      expect(viewDateInput().value).toBe('2026-08-15')
      expect(urlParams().has('kd')).toBe(false)
    })

    it('treats a same-day focus as a no-op — no extra request', async () => {
      vi.setSystemTime(new Date('2026-08-14T09:00:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')
      expect(mockGetFeed).toHaveBeenCalledTimes(1)

      vi.setSystemTime(new Date('2026-08-14T15:00:00Z'))
      fireEvent(window, new Event('focus'))

      await flush()
      expect(mockGetFeed).toHaveBeenCalledTimes(1)
    })

    it('leaves a user-picked view date alone when the day rolls over', async () => {
      vi.setSystemTime(new Date('2026-08-14T20:55:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?kd=2026-06-01'])
      await screen.findByText('Коваленко Іван Петрович')

      vi.setSystemTime(new Date('2026-08-15T05:00:00Z'))
      fireEvent(window, new Event('focus'))

      await flush()
      // `today` only backs the DEFAULT: with the date picked in the URL, the
      // rollover neither refetches nor moves what is sent or shown.
      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(lastCall().view_date).toBe('2026-06-01')
      expect(viewDateInput().value).toBe('2026-06-01')
    })
  })
})

describe('ContactTagFeedTab — the three-state sell_to', () => {
  it('DEFAULT: sends no sell_to at all and shows the bound the backend echoes back', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { sell_to: '2026-04-30' }))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // The key must be genuinely ABSENT — that is the only way the backend can
    // tell "apply your default" from "switch the bound off".
    expect('sell_to' in lastCall()).toBe(false)
    expect(urlParams().has('kt')).toBe(false)
    // The field stays empty (nobody picked anything)...
    expect(sellToInput().value).toBe('')
    // ...and the applied default is stated from the ANSWER's echo, formatted as
    // a calendar day. The tab never recomputes the month−4 arithmetic itself.
    expect(
      await screen.findByText('pages.reports.contactTag.sellToDefaultHint:04/30/2026')
    ).toBeInTheDocument()
  })

  it('DEFAULT: says nothing about the applied bound before the first answer lands', async () => {
    // A hint is a statement about the data; with no response there is no
    // applied window to name, and inventing one is the drift it exists to avoid.
    mockGetFeed.mockImplementation(() => new Promise<ContactTagFeedResponse>(() => {}))

    renderTab()

    await waitFor(() => expect(mockGetFeed).toHaveBeenCalled())
    expect(
      screen.queryByText(/pages\.reports\.contactTag\.sellToDefaultHint/)
    ).not.toBeInTheDocument()
  })

  it('DEFAULT: never presents the PREVIOUS answer’s bound as the default while the switch flies', async () => {
    // keepPreviousData keeps the EXPLICIT answer on screen while the defaulted
    // request is in flight — and that answer's echo is the date the operator
    // just stopped asking for. A hint reading it off `query.data` would spend
    // the whole round trip announcing "the default is 30.06.2026" about a bound
    // the user had picked by hand: the exact drift the echo exists to prevent,
    // only sourced from a stale frame instead of stale arithmetic.
    let resolveDefaulted: (value: ContactTagFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(makeResponse([makeRow()], { sell_to: '2026-06-30' }))
      .mockImplementationOnce(
        () => new Promise<ContactTagFeedResponse>((resolve) => (resolveDefaulted = resolve))
      )

    renderTab(['/?kt=2026-06-30'])
    await screen.findByText('Коваленко Іван Петрович')
    // Explicit: the field states the bound, so neither hint applies.
    expect(
      screen.queryByText(/pages\.reports\.contactTag\.sellToDefaultHint/)
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.contactTag.restoreSellToDefault' })
    )

    // The transitional frame: mode is already `default`, the rows on screen are
    // still the explicit answer's.
    expect(await screen.findByTestId('contact-tag-refreshing')).toBeInTheDocument()
    await waitFor(() => expect(urlParams().has('kt')).toBe(false))
    expect(
      screen.queryByText(/pages\.reports\.contactTag\.sellToDefaultHint/)
    ).not.toBeInTheDocument()
    // ...and the superseded date is nowhere on screen under any wording.
    expect(screen.queryByText(/06\/30\/2026/)).not.toBeInTheDocument()

    resolveDefaulted(makeResponse([makeRow()], { sell_to: '2026-04-30' }))

    // Only the answer that belongs to the state on screen gets to speak.
    expect(
      await screen.findByText('pages.reports.contactTag.sellToDefaultHint:04/30/2026')
    ).toBeInTheDocument()
  })

  it('DEFAULT: never presents the PREVIOUS reference day’s bound while a new one flies', async () => {
    // The mode-based gate above cannot see this one: the applied default is
    // DERIVED from `view_date` (the last day of the month four months before
    // it), so moving the reference day moves the bound while the sell mode
    // stays `default` throughout. keepPreviousData holds the old answer on
    // screen meanwhile, and a hint reading its echo would name a window
    // computed for a day the strip no longer shows — for the whole round trip,
    // and indefinitely if that refetch fails, leaving a superseded date sitting
    // next to the error. Hence the second half of the gate: the answer's OWN
    // `view_date` echo, which cannot drift the way a remembered value can.
    let resolveSecond: (value: ContactTagFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { view_date: '2026-08-26', sell_to: '2026-04-30' })
      )
      .mockImplementationOnce(
        () => new Promise<ContactTagFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab(['/?kd=2026-08-26'])
    expect(
      await screen.findByText('pages.reports.contactTag.sellToDefaultHint:04/30/2026')
    ).toBeInTheDocument()

    fireEvent.change(viewDateInput(), { target: { value: '2026-01-15' } })

    // The transitional frame: the sell mode has not moved at all, and the rows
    // on screen are still August's.
    await waitFor(() => expect(lastCall().view_date).toBe('2026-01-15'))
    expect(
      screen.queryByText(/pages\.reports\.contactTag\.sellToDefaultHint/)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/04\/30\/2026/)).not.toBeInTheDocument()

    resolveSecond(makeResponse([makeRow()], { view_date: '2026-01-15', sell_to: '2025-09-30' }))

    // Only the answer computed for the day on screen gets to name its bound.
    expect(
      await screen.findByText('pages.reports.contactTag.sellToDefaultHint:09/30/2025')
    ).toBeInTheDocument()
  })

  it('DEFAULT: keeps the hint standing through a page turn — the applied bound has not moved', async () => {
    // The counterpart of the test above, and the reason it cannot simply be
    // "hide the hint whenever a request is in flight". Paging is THE interaction
    // of this feed (~880 pages), it changes the query key on every click, and
    // the defaulted window it re-asks for is the same one the line already
    // names. A hint gated on `isPlaceholderData` blinks out and back on every
    // page turn — and, being a full-width line in the filter strip, takes the
    // strip's height (and everything below it) with it.
    let resolveSecond: (value: ContactTagFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], {
          sell_to: '2026-04-30',
          total: 130,
          page: 1,
          total_pages: 3,
        })
      )
      .mockImplementationOnce(
        () => new Promise<ContactTagFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    expect(
      await screen.findByText('pages.reports.contactTag.sellToDefaultHint:04/30/2026')
    ).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('2'))

    // The transitional frame: the previous page's rows under the busy overlay,
    // the very same defaulted window still in force.
    expect(await screen.findByTestId('contact-tag-refreshing')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.contactTag.sellToDefaultHint:04/30/2026')
    ).toBeInTheDocument()

    resolveSecond(
      makeResponse([makeRow({ client_id: 5, employee_name: 'Оновленко Олег' })], {
        sell_to: '2026-04-30',
        total: 130,
        page: 2,
        total_pages: 3,
      })
    )

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.contactTag.sellToDefaultHint:04/30/2026')
    ).toBeInTheDocument()
  })

  it('DEFAULT → OFF: the "switch off" button writes an EMPTY ?kt= and sends sell_to=""', async () => {
    // The picker's "×" cannot serve this edge — the field is empty in the
    // default state, so the shared DateSelect renders no "×" at all.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')
    expect(
      screen.queryByRole('button', { name: 'pages.reports.contactTag.clearSellTo' })
    ).not.toBeInTheDocument()

    mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { sell_to: null }))
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.contactTag.disableSellTo' })
    )

    // Present-and-empty in the URL, empty string on the wire.
    await waitFor(() => expect(urlParams().get('kt')).toBe(''))
    await waitFor(() => expect(lastCall().sell_to).toBe(''))
    // ...and the hint changes its story rather than disappearing.
    expect(await screen.findByText('pages.reports.contactTag.sellToOffHint')).toBeInTheDocument()
    expect(
      screen.queryByText(/pages\.reports\.contactTag\.sellToDefaultHint/)
    ).not.toBeInTheDocument()
  })

  it('EXPLICIT: a picked date goes to the URL and the wire verbatim', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { sell_to: '2026-06-30' }))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    fireEvent.change(sellToInput(), { target: { value: '2026-06-30' } })

    await waitFor(() => expect(urlParams().get('kt')).toBe('2026-06-30'))
    await waitFor(() => expect(lastCall().sell_to).toBe('2026-06-30'))
    // With the bound explicit, neither hint applies — the field itself says it.
    await waitFor(() => expect(sellToInput().value).toBe('2026-06-30'))
    expect(
      screen.queryByText(/pages\.reports\.contactTag\.sellToDefaultHint/)
    ).not.toBeInTheDocument()
    expect(screen.queryByText('pages.reports.contactTag.sellToOffHint')).not.toBeInTheDocument()
  })

  it('EXPLICIT → OFF: the picker "×" switches the bound OFF, it does not restore the default', async () => {
    // The gesture's meaning is the source system's: clearing the field is how
    // the operator says "show me the whole portfolio". Deleting the key instead
    // would silently re-apply a four-month-old default — the opposite.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { sell_to: '2026-06-30' }))

    renderTab(['/?kt=2026-06-30'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(lastCall().sell_to).toBe('2026-06-30')

    mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { sell_to: null }))
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.contactTag.clearSellTo' })
    )

    await waitFor(() => expect(urlParams().get('kt')).toBe(''))
    await waitFor(() => expect(lastCall().sell_to).toBe(''))
    // The key is still THERE — an absent key is the third, different state.
    expect(urlParams().has('kt')).toBe(true)
    expect(await screen.findByText('pages.reports.contactTag.sellToOffHint')).toBeInTheDocument()
  })

  it('OFF: claims nothing about the portfolio while a filter error blocks the request', async () => {
    // The off hint is a statement about what is ON SCREEN — "no upper bound,
    // so this is the whole portfolio". With an unusable date anywhere in the
    // strip nothing was ever asked for, so the screen holds an inline hint and
    // no rows at all: the sentence would describe a feed that does not exist,
    // and would read as a reason to trust an empty screen.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { sell_to: null }))

    renderTab(['/?kd=2026-02-31&kt='])

    expect(await screen.findByText('pages.reports.contactTag.invalidViewDate')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
    expect(screen.queryByText('pages.reports.contactTag.sellToOffHint')).not.toBeInTheDocument()
  })

  it('OFF: does not claim the whole portfolio over rows a bound had trimmed', async () => {
    // The mirror image of the explicit → default drift above, and the same
    // keepPreviousData frame: the moment the "×" switches the bound off the
    // mode is already `off`, while the rows on screen are still the ones the
    // explicit bound trimmed. "You are looking at the whole portfolio" is a
    // claim about THOSE rows, and it is false about them. The answer's own
    // echo settles it — `sell_to: null` is what "no upper bound was applied"
    // looks like on the wire.
    let resolveOff: (value: ContactTagFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(makeResponse([makeRow()], { sell_to: '2026-06-30' }))
      .mockImplementationOnce(
        () => new Promise<ContactTagFeedResponse>((resolve) => (resolveOff = resolve))
      )

    renderTab(['/?kt=2026-06-30'])
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.contactTag.clearSellTo' })
    )

    expect(await screen.findByTestId('contact-tag-refreshing')).toBeInTheDocument()
    await waitFor(() => expect(urlParams().get('kt')).toBe(''))
    expect(screen.queryByText('pages.reports.contactTag.sellToOffHint')).not.toBeInTheDocument()

    resolveOff(makeResponse([makeRow()], { sell_to: null }))

    expect(await screen.findByText('pages.reports.contactTag.sellToOffHint')).toBeInTheDocument()
  })

  it('OFF: keeps the hint standing through a page turn — the bound is still off', async () => {
    // The counterpart of the test above: the echo gate must not turn the line
    // into an `isPlaceholderData` flicker on this feed's commonest interaction.
    let resolveSecond: (value: ContactTagFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { sell_to: null, total: 130, page: 1, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<ContactTagFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab(['/?kt='])
    expect(await screen.findByText('pages.reports.contactTag.sellToOffHint')).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('2'))

    expect(await screen.findByTestId('contact-tag-refreshing')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.contactTag.sellToOffHint')).toBeInTheDocument()

    resolveSecond(
      makeResponse([makeRow({ client_id: 5, employee_name: 'Оновленко Олег' })], {
        sell_to: null,
        total: 130,
        page: 2,
        total_pages: 3,
      })
    )

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.contactTag.sellToOffHint')).toBeInTheDocument()
  })

  it('OFF: says nothing before the first answer lands either — same rule as the default hint', async () => {
    mockGetFeed.mockImplementation(() => new Promise<ContactTagFeedResponse>(() => {}))

    renderTab(['/?kt='])

    await waitFor(() => expect(mockGetFeed).toHaveBeenCalled())
    expect(screen.queryByText('pages.reports.contactTag.sellToOffHint')).not.toBeInTheDocument()
  })

  it.each([
    ['OFF', '/?kt='],
    ['EXPLICIT', '/?kt=2026-06-30'],
  ])(
    '%s → DEFAULT: the restore button deletes the key so the backend defaults again',
    async (_case, entry) => {
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab([entry])
      await screen.findByText('Коваленко Іван Петрович')
      expect('sell_to' in lastCall()).toBe(true)

      await userEvent.click(
        screen.getByRole('button', { name: 'pages.reports.contactTag.restoreSellToDefault' })
      )

      await waitFor(() => expect(urlParams().has('kt')).toBe(false))
      await waitFor(() => expect('sell_to' in lastCall()).toBe(false))
      expect(
        await screen.findByText('pages.reports.contactTag.sellToDefaultHint:04/30/2026')
      ).toBeInTheDocument()
    }
  )

  it('offers exactly one control per edge — no button that would be a no-op', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    // In DEFAULT: "switch off" is offered, "restore default" is not.
    const view = renderTab()
    await screen.findByText('Коваленко Іван Петрович')
    expect(
      screen.getByRole('button', { name: 'pages.reports.contactTag.disableSellTo' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.contactTag.restoreSellToDefault' })
    ).not.toBeInTheDocument()
    view.unmount()

    // In OFF: the other way round, and still no "×" (the field is empty).
    renderTab(['/?kt='])
    await screen.findByText('Коваленко Іван Петрович')
    expect(
      screen.queryByRole('button', { name: 'pages.reports.contactTag.disableSellTo' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'pages.reports.contactTag.restoreSellToDefault' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.contactTag.clearSellTo' })
    ).not.toBeInTheDocument()
  })

  it('treats the three states as three DIFFERENT requests, never one cached answer', async () => {
    // The whole contract rests on this: `{}`, `{ sell_to: '' }` and
    // `{ sell_to: '2026-06-30' }` are three React Query keys. A frontend that
    // folded two of them together would show the operator a window they
    // switched off.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenCalledTimes(1)

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.contactTag.disableSellTo' })
    )
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))

    fireEvent.change(sellToInput(), { target: { value: '2026-06-30' } })
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(3))

    const shapes = mockGetFeed.mock.calls.map(([params]) =>
      'sell_to' in params ? `set:${params.sell_to}` : 'absent'
    )
    expect(shapes).toEqual(['absent', 'set:', 'set:2026-06-30'])
  })

  it('carries the switched-off state through a page change', async () => {
    // `?kt=` is a real state a shared link must be able to hold; a URL
    // serialiser that dropped an empty value would quietly restore the default
    // on the second page.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { sell_to: null, total: 130, page: 1, total_pages: 3 })
    )

    renderTab(['/?kt='])
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('2'))

    await waitFor(() => expect(lastCall()).toMatchObject({ sell_to: '', skip: 50 }))
    expect(urlParams().get('kt')).toBe('')
  })

  it('blocks a hand-edited ?kt= that is not a real calendar date', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?kt=2026-02-31'])

    expect(await screen.findByText('pages.reports.contactTag.invalidSellDate')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
    expect(sellToInput()).toHaveAttribute('aria-invalid', 'true')
    expect(sellFromInput()).not.toHaveAttribute('aria-invalid')
    // The bad value shows as an empty field — the default does not stand in
    // for it, and the state is still "the user pinned a bound", so neither
    // hint claims a window is in force.
    expect(sellToInput().value).toBe('')
    expect(
      screen.queryByText(/pages\.reports\.contactTag\.sellToDefaultHint/)
    ).not.toBeInTheDocument()
  })

  it('does not let an unusable ?kt= read the SWITCHED-OFF state’s cached answer', async () => {
    // An unusable bound is a state of its own, and it must not alias onto a
    // valid one: a request shape of `{ sell_to: '' }` for it would be
    // byte-for-byte the off state's, i.e. the very same React Query key. The
    // blocked query would then be handed the off state's answer out of the
    // cache — and `usePagedFeedPages` would act on it, healing `?kpg=` from a
    // response the current URL never asked for.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const renderWith = (entries: string[]) =>
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={entries}>
            <ContactTagFeedTab />
            <LocationProbe />
          </MemoryRouter>
        </QueryClientProvider>
      )

    // First, populate the cache under the OFF state, at a page the feed no
    // longer has (so an answer read here would visibly rewrite the URL).
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], {
        sell_to: null,
        total: 90,
        page: 5,
        page_size: 50,
        total_pages: 2,
      })
    )

    const view = renderWith(['/?kt=&kpg=5'])
    await screen.findByText('Коваленко Іван Петрович')
    await waitFor(() => expect(urlParams().get('kpg')).toBe('2'))
    view.unmount()
    const callsSoFar = mockGetFeed.mock.calls.length

    // Now the same page window with an UNUSABLE upper bound, on the same cache.
    renderWith(['/?kt=2026-02-31&kpg=5'])

    expect(await screen.findByText('pages.reports.contactTag.invalidSellDate')).toBeInTheDocument()
    // Nothing was asked for...
    expect(mockGetFeed).toHaveBeenCalledTimes(callsSoFar)
    // ...and nothing answered: the deep page stands as the URL spells it,
    // rather than being healed by another state's answer.
    expect(urlParams().get('kpg')).toBe('5')
  })
})

describe('ContactTagFeedTab — the optional lower bound', () => {
  it('omits sell_from entirely when unset', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    expect('sell_from' in lastCall()).toBe(false)
  })

  it('sends a picked lower bound and drops the key again on "×"', async () => {
    // Unlike `sell_to`, absent and empty mean the SAME thing here (no default),
    // so the "×" is a plain key deletion.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?kf=2026-01-01'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(lastCall().sell_from).toBe('2026-01-01')

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.contactTag.clearSellFrom' })
    )

    await waitFor(() => expect(urlParams().has('kf')).toBe(false))
    await waitFor(() => expect('sell_from' in lastCall()).toBe(false))
  })

  it('blocks an inverted window whose BOTH bounds are explicit, and recovers', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?kf=2026-06-20&kt=2026-06-10'])

    expect(await screen.findByText('pages.reports.contactTag.invalidSellRange')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
    // A pair error stays a standalone alert: neither bound is wrong on its own.
    expect(sellFromInput()).not.toHaveAttribute('aria-invalid')
    expect(sellToInput()).not.toHaveAttribute('aria-invalid')

    fireEvent.change(sellToInput(), { target: { value: '2026-06-25' } })

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(lastCall()).toMatchObject({ sell_from: '2026-06-20', sell_to: '2026-06-25' })
  })

  it('does NOT pre-empt an inversion against the DEFAULTED upper bound — the backend explains it', async () => {
    // "Purchased since last month" against a default bound four months back
    // inverts the window without a single bad value. The tab cannot name the
    // applied date (it does not compute it), and the backend's 400 does —
    // together with the empty-value escape hatch. So the request goes out.
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, {
        detail:
          'sell_from must not be after sell_to (the applied sell_to is 2026-04-30; send an empty sell_to to switch the upper bound off)',
      })
    )

    renderTab(['/?kf=2026-07-01'])

    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(1))
    expect(lastCall().sell_from).toBe('2026-07-01')
    expect('sell_to' in lastCall()).toBe(false)
    // No local guard fired...
    expect(screen.queryByText('pages.reports.contactTag.invalidSellRange')).not.toBeInTheDocument()
    // ...and the server's sentence — the only one that knows the applied date
    // and the way out — is shown verbatim.
    expect(await screen.findByText(/the applied sell_to is 2026-04-30/)).toBeInTheDocument()
  })
})

describe('ContactTagFeedTab — calendar policy', () => {
  it('leaves the view-date calendar fully open (no min/max)', async () => {
    // The page-wide rule for every DEFAULTED date (searcher, inbound,
    // processing, operator-promises): a bound nothing on screen states must not
    // grey out days. This one has no partner to be ordered against at all — the
    // sale window bounds a different column entirely.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?kf=2026-01-01&kt=2026-06-30'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(viewDateInput()).not.toHaveAttribute('data-min')
    expect(viewDateInput()).not.toHaveAttribute('data-max')
  })

  it('keeps the sale pair mutually bounded — the precedent of the two optional-window feeds', async () => {
    // Cards 125 and 148 keep their mutual picker bounds because their bounds
    // start EMPTY: with no default there is no order trap to remove. This pair
    // is the same kind, so the bounds stay.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?kf=2026-01-01&kt=2026-06-30'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(sellFromInput()).toHaveAttribute('data-max', '2026-06-30')
    expect(sellToInput()).toHaveAttribute('data-min', '2026-01-01')
  })

  it('leaves the lower bound unbounded while the upper one is DEFAULTED or OFF', async () => {
    // The bound in force in those two states is not a value on screen — it is
    // the backend's (or none at all), and greying days out against a date the
    // user cannot see is precisely the order trap the defaulted-window rule
    // forbids. The backend's 400 is the guard there instead.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    const view = renderTab(['/?kf=2026-01-01'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(sellFromInput()).not.toHaveAttribute('data-max')
    view.unmount()

    renderTab(['/?kf=2026-01-01&kt='])
    await screen.findByText('Коваленко Іван Петрович')
    expect(sellFromInput()).not.toHaveAttribute('data-max')
  })

  it('lets an inverted pair be PICKED and answers with the guard, not a dead calendar', async () => {
    // Manual input and hand-edited URLs bypass picker bounds anyway, so the
    // pair guard is what actually protects the API.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?kf=2026-06-10&kt=2026-06-20'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenCalledTimes(1)

    fireEvent.change(sellToInput(), { target: { value: '2026-06-01' } })

    expect(await screen.findByText('pages.reports.contactTag.invalidSellRange')).toBeInTheDocument()
    // The choice is kept (the user can fix either bound), but nothing is sent.
    await waitFor(() => expect(urlParams().get('kt')).toBe('2026-06-01'))
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
  })
})

describe('ContactTagFeedTab — tag sub-tabs', () => {
  const mixedPage = [
    makeRow({ client_id: 1, inn: '111', tag_code: 'kontakt', tag_name: 'Контакт' }),
    makeRow({ client_id: 2, inn: '222', tag_code: 'nekontakt', tag_name: 'Неконтакт' }),
    makeRow({ client_id: 3, inn: '333', tag_code: 'kontakt', tag_name: 'Контакт' }),
  ]

  it('opens on «Всі» with every row, and counts the page in each tab', async () => {
    mockGetFeed.mockResolvedValue(makeResponse(mixedPage))

    renderTab()
    await screen.findByRole('link', { name: '111' })

    expect(subtab('all', 3)).toHaveAttribute('aria-selected', 'true')
    expect(subtab('kontakt', 2)).toBeInTheDocument()
    expect(subtab('nekontakt', 1)).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    // The FILTERING and the counts are both page-scoped, and the line between
    // the strip and the table says so — this feed is ~880 pages long and the
    // endpoint takes no tag parameter, so neither can ever speak for the whole
    // feed. ONCE, though: a line every reader gets, not also a per-tab `title`
    // that repeats it on hover for mouse users alone.
    expect(screen.getByText('pages.reports.contactTag.subtabCountScope')).toBeInTheDocument()
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).not.toHaveAttribute('title')
    }
  })

  it('appends no count — and no scope caveat — until there is a page to count', async () => {
    // "Всі (0)" before the first answer states a fact about the feed — zero
    // tagged clients — that nothing has established; the same goes for a filter
    // error, which stops the request from being made at all. The caveat under
    // the strip rides the same gate: it qualifies counts and a filtered page,
    // and with neither on screen it is one more line to read past.
    mockGetFeed.mockImplementation(() => new Promise<ContactTagFeedResponse>(() => {}))

    const view = renderTab()
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalled())

    expect(
      screen.getByRole('tab', { name: 'pages.reports.contactTag.subtabs.all' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /\(0\)/ })).not.toBeInTheDocument()
    expect(screen.queryByText('pages.reports.contactTag.subtabCountScope')).not.toBeInTheDocument()
    view.unmount()

    renderTab(['/?kd=2026-02-31'])
    await screen.findByText('pages.reports.contactTag.invalidViewDate')

    expect(
      screen.getByRole('tab', { name: 'pages.reports.contactTag.subtabs.all' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /\(0\)/ })).not.toBeInTheDocument()
    expect(screen.queryByText('pages.reports.contactTag.subtabCountScope')).not.toBeInTheDocument()
  })

  it('filters by tag_code and writes the choice to ?kg=', async () => {
    mockGetFeed.mockResolvedValue(makeResponse(mixedPage))

    renderTab()
    await screen.findByRole('link', { name: '111' })

    await userEvent.click(subtab('kontakt', 2))

    await waitFor(() => expect(urlParams().get('kg')).toBe('kontakt'))
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['111', '333'])
    // The counts do not move with the selection — they describe the page.
    expect(subtab('all', 3)).toBeInTheDocument()
  })

  it('never spells the default sub-tab out in the URL', async () => {
    mockGetFeed.mockResolvedValue(makeResponse(mixedPage))

    renderTab(['/?kg=nekontakt'])
    await screen.findByRole('link', { name: '222' })

    await userEvent.click(subtab('all', 3))

    // A shared link then carries only choices somebody made.
    await waitFor(() => expect(urlParams().has('kg')).toBe(false))
  })

  it('does NOT refetch or reset the page when the sub-tab changes', async () => {
    // The sub-tab filters rows already on screen — it changes no request, so
    // resetting the page would throw away the operator's position in an
    // 880-page feed for nothing.
    mockGetFeed.mockResolvedValue(
      makeResponse(mixedPage, { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?kpg=3'])
    await screen.findByRole('link', { name: '111' })
    expect(mockGetFeed).toHaveBeenCalledTimes(1)

    await userEvent.click(subtab('nekontakt', 1))

    await waitFor(() => expect(urlParams().get('kg')).toBe('nekontakt'))
    expect(urlParams().get('kpg')).toBe('3')
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
  })

  it('survives a page change and keeps filtering the new page', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse(mixedPage, { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?kg=kontakt'])
    await screen.findByRole('link', { name: '111' })
    expect(subtab('kontakt', 2)).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByTitle('2'))

    await waitFor(() => expect(lastCall().skip).toBe(50))
    expect(urlParams().get('kg')).toBe('kontakt')
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['111', '333'])
  })

  it.each([
    ['an unknown id', '/?kg=kontakty'],
    ['a LOCALIZED name instead of the code', '/?kg=%D0%9A%D0%BE%D0%BD%D1%82%D0%B0%D0%BA%D1%82'],
  ])('degrades %s to «Всі» without rewriting the URL', async (_case, entry) => {
    mockGetFeed.mockResolvedValue(makeResponse(mixedPage))

    renderTab([entry])
    await screen.findByRole('link', { name: '111' })

    expect(subtab('all', 3)).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('link')).toHaveLength(3)
    // A stale view preference is harmless; rewriting it would destroy the deep
    // link the moment it was opened.
    expect(urlParams().has('kg')).toBe(true)
  })

  it('tells "this tag has nothing here" apart from "the feed has nothing"', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow({ client_id: 2, inn: '222', tag_code: 'nekontakt' })])
    )

    renderTab(['/?kg=kontakt'])

    expect(await screen.findByText('pages.reports.contactTag.emptyTag')).toBeInTheDocument()
    expect(screen.queryByText('pages.reports.contactTag.empty')).not.toBeInTheDocument()
    // The pager follows the FEED, not the tab: hiding this page's rows has not
    // made the feed shorter.
    expect(screen.getByText('Page')).toBeInTheDocument()
  })

  it('keeps a row whose code is outside the configured pair on «Всі» only', async () => {
    // Only reachable if CONTACT_TAG_FEED_TAG_CODES is reconfigured. Nothing is
    // hidden — the default tab shows it and the table names its tag.
    mockGetFeed.mockResolvedValue(
      makeResponse([
        ...mixedPage,
        makeRow({ client_id: 4, inn: '444', tag_code: 'vip', tag_name: 'VIP' }),
      ])
    )

    renderTab()
    await screen.findByRole('link', { name: '444' })

    expect(subtab('all', 4)).toBeInTheDocument()
    // The two halves visibly disagree (2 + 1 < 4), which is the honest signal.
    expect(subtab('kontakt', 2)).toBeInTheDocument()
    expect(subtab('nekontakt', 1)).toBeInTheDocument()

    await userEvent.click(subtab('kontakt', 2))
    await waitFor(() => expect(screen.queryByRole('link', { name: '444' })).not.toBeInTheDocument())
  })

  it('labels the panel with the active sub-tab', async () => {
    mockGetFeed.mockResolvedValue(makeResponse(mixedPage))

    renderTab(['/?kg=nekontakt'])
    await screen.findByRole('link', { name: '222' })

    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'contact-tag-panel-nekontakt')
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'contact-tag-tab-nekontakt'
    )
  })
})

describe('ContactTagFeedTab — paging', () => {
  it('round-trips every filter and the page window through the URL', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 44113, page: 2, page_size: 100, total_pages: 442 })
    )

    renderTab(['/?kd=2026-08-26&kf=2026-01-01&kt=2026-06-30&kg=nekontakt&kpg=2&kps=100'])
    await screen.findByText('Коваленко Іван Петрович')

    // skip is derived from the ACTIVE page size, not the default one.
    expect(lastCall()).toEqual({
      project_id: 1,
      view_date: '2026-08-26',
      sell_from: '2026-01-01',
      sell_to: '2026-06-30',
      skip: 100,
      limit: 100,
    })
    expect(viewDateInput().value).toBe('2026-08-26')
    expect(sellFromInput().value).toBe('2026-01-01')
    expect(sellToInput().value).toBe('2026-06-30')
  })

  it('pages through the feed with the right skip and keeps the page in the URL', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 44113, page: 1, page_size: 50, total_pages: 883 })
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('3'))

    await waitFor(() => expect(urlParams().get('kpg')).toBe('3'))
    await waitFor(() => expect(lastCall()).toMatchObject({ skip: 100, limit: 50 }))
  })

  it.each([
    ['a size outside the offered options', '/?kps=999'],
    ['a non-numeric size', '/?kps=abc'],
  ])('falls back to the default limit for %s', async (_case, entry) => {
    // 999 would also break the backend's `limit <= 500`. A page size is a view
    // preference, not a filter: an unusable one is ignored silently.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(lastCall().limit).toBe(50)
    expect(urlParams().has('kps')).toBe(true)
  })

  it('writes a non-default rows-per-page into ?kps=, drops it again for the default', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 44113, page: 1, page_size: 50, total_pages: 883 })
    )

    renderTab(['/?kpg=3'])
    await screen.findByText('Коваленко Іван Петрович')

    await selectPageSize('100')

    // A new page size invalidates the old offset — the pager resets to page 1,
    // and page 1 is the default, so `kpg` leaves the URL in the same update.
    // (The shared Pagination fires onPageSizeChange and onPageChange back to
    // back; the shell's ref composition is what keeps both keys.)
    await waitFor(() => expect(urlParams().get('kps')).toBe('100'))
    expect(urlParams().has('kpg')).toBe(false)
    await waitFor(() => expect(lastCall()).toMatchObject({ skip: 0, limit: 100 }))

    await selectPageSize('50')

    await waitFor(() => expect(urlParams().has('kps')).toBe(false))
    await waitFor(() => expect(lastCall().limit).toBe(50))
  })

  it('falls back to page 1 for a ?kpg= whose offset would overflow the int32 skip cap', async () => {
    // (100000000 - 1) * 50 ≈ 5e9 — past the backend's `skip <= 2147483647`, so
    // the request could only come back 422.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?kpg=100000000'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(lastCall().skip).toBe(0)
    expect(pageIndicator()).toEqual(['1', '3'])
    expect(urlParams().get('kpg')).toBe('100000000')
  })

  it('heals a stale ?kpg= down to the last page the answer still has', async () => {
    // A bookmarked deep page outlives the rows it pointed at: this feed is
    // ~880 pages long and its population moves by thousands a day.
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 })
      )

    renderTab(['/?kpg=5'])

    // The page count is only known from an answer, so the stale offset does go
    // out once — but exactly once, and never again after the URL self-heals.
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 200 }))
    )
    await waitFor(() => expect(urlParams().get('kpg')).toBe('2'))
    await waitFor(() => expect(lastCall()).toMatchObject({ skip: 50, limit: 50 }))
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledTimes(2)
    expect(pageIndicator()).toEqual(['2', '2'])
  })

  it('never renders "Page N of M" with N past M while a stale ?kpg= heals', async () => {
    let resolveHealed: (value: ContactTagFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockImplementationOnce(
        () => new Promise<ContactTagFeedResponse>((resolve) => (resolveHealed = resolve))
      )

    renderTab(['/?kpg=5'])

    expect(await screen.findByTestId('contact-tag-refreshing')).toBeInTheDocument()
    expect(pageIndicator()).toEqual(['2', '2'])
    expect(screen.queryByTitle('5')).not.toBeInTheDocument()

    resolveHealed(makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 }))

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()

    // The commit BETWEEN the stale answer landing and the URL self-heal is the
    // frame a waitFor cannot see — so the invariant is asserted over every
    // frame the pager was actually rendered with (the recorder above).
    expect(paginationFrames.length).toBeGreaterThan(0)
    for (const frame of paginationFrames) {
      expect(frame.currentPage).toBeLessThanOrEqual(frame.totalPages)
    }
  })

  it('marks previous rows as busy while a new page is loading', async () => {
    let resolveSecond: (value: ContactTagFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<ContactTagFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('2'))

    expect(await screen.findByTestId('contact-tag-refreshing')).toBeInTheDocument()
    expect(screen.getByText('Коваленко Іван Петрович')).toBeInTheDocument()

    resolveSecond(
      makeResponse([makeRow({ client_id: 5, employee_name: 'Оновленко Олег' })], {
        total: 130,
        page: 2,
        page_size: 50,
        total_pages: 3,
      })
    )

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('contact-tag-refreshing')).not.toBeInTheDocument()
    )
  })

  it('shows the calm empty state (and no pager) for a window with nothing to work', async () => {
    // Zero tagged clients and zero surviving candidates both answer 200 — not
    // a fault, and not something to dress as one.
    mockGetFeed.mockResolvedValue(makeResponse([], { total: 0, total_pages: 0 }))

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.empty')).toBeInTheDocument()
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('ContactTagFeedTab — the rest of the contract and the error ladder', () => {
  it('renders the contract row end to end — every column of the answer', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow({ last_planed_interaction_date: '2026-08-01' })], {
        total: 1,
        total_pages: 1,
      })
    )

    renderTab()

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '3210987654' })).toHaveAttribute(
      'href',
      '/dashboard/clients/421395'
    )
    expect(screen.getByText('Неконтакт')).toBeInTheDocument()
    expect(screen.getByText('Стягнення')).toBeInTheDocument()
    expect(screen.getByText('Група №3')).toBeInTheDocument()
    // Every date-only column stays its own calendar day, whatever the profile
    // zone: each is cut server-side in a deliberately chosen zone.
    expect(screen.getByText('03/11/2026')).toBeInTheDocument()
    expect(screen.getByText('06/02/2026')).toBeInTheDocument()
    expect(screen.getByText('08/01/2026')).toBeInTheDocument()
    expect(screen.getByText('08/14/2026')).toBeInTheDocument()
    // Money, from the exact Decimal string.
    expect(screen.getByText('15,000.00')).toBeInTheDocument()
  })

  it('never renders generated_at as a freshness stamp', async () => {
    // The feed IS cached (15 min), but per WORKER: production runs eight, each
    // with its own stamp, so two refreshes can legitimately show two ages in
    // either order. Every sibling feed tab makes the same call.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { generated_at: '2026-08-26T08:31:02.114Z' })
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    expect(screen.queryByText(/2026-08-26T08:31/)).not.toBeInTheDocument()
    expect(screen.queryByText(/26-08-2026 08:31/)).not.toBeInTheDocument()
  })

  it('neither consumes nor clobbers the other report tabs’ URL params', async () => {
    // The host page keeps every tab's params in the URL, so this tab renders
    // with the verification (`cf`, `ct`), gap (`gf`, `gt`, `gpg`) and inbound
    // (`nf`, `npg`) keys present. `ct` is the dangerous one: it is the
    // abbreviation this tab would have taken for its own sale-date bound.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([
      '/?tab=contact-tag&cf=2026-03-03&ct=2026-03-09&gf=2026-02-02&gt=2026-02-09&gpg=4&nf=2026-01-01&npg=7&nps=100',
    ])
    await screen.findByText('Коваленко Іван Петрович')

    // Foreign date keys are not this tab's window and the sibling feeds' paging
    // is not this tab's paging.
    const params = lastCall()
    expect('sell_to' in params).toBe(false)
    expect('sell_from' in params).toBe(false)
    expect(params.skip).toBe(0)
    expect(params.limit).toBe(50)
    expect(params.view_date).not.toBe('2026-03-09')

    // Now write this tab's own state...
    fireEvent.change(sellFromInput(), { target: { value: '2026-08-05' } })
    await waitFor(() => expect(urlParams().get('kf')).toBe('2026-08-05'))

    // ...and every foreign key survives verbatim.
    const after = urlParams()
    expect(after.get('tab')).toBe('contact-tag')
    expect(after.get('cf')).toBe('2026-03-03')
    expect(after.get('ct')).toBe('2026-03-09')
    expect(after.get('gf')).toBe('2026-02-02')
    expect(after.get('gt')).toBe('2026-02-09')
    expect(after.get('gpg')).toBe('4')
    expect(after.get('nf')).toBe('2026-01-01')
    expect(after.get('npg')).toBe('7')
    expect(after.get('nps')).toBe('100')
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetFeed
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.contactTag.error.retry' })
    )

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
  })

  it('passes the candidate-cap refusal through so the operator knows which knob to turn', async () => {
    // The hard cap is deliberately a 400, not a 503: its detail names the
    // maximum and the remedy, and the shared axios client does not auto-retry a
    // 400 over the very population the cap refuses to fan out over.
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, {
        detail:
          'Contact-tag feed: more than the configured maximum of 200000 candidates; request a narrower sell window',
      })
    )

    renderTab()

    expect(await screen.findByText(/request a narrower sell window/)).toBeInTheDocument()
    expect(screen.queryByText('pages.reports.contactTag.error.title')).not.toBeInTheDocument()
    expect(screen.queryByText('pages.reports.contactTag.unavailable')).not.toBeInTheDocument()
    // A 400 IS retryable by hand — the state it refuses is a filter choice.
    expect(
      screen.getByRole('button', { name: 'pages.reports.contactTag.error.retry' })
    ).toBeInTheDocument()
  })

  it('falls back to the localized title for a 400 whose body never arrived', async () => {
    // A proxy that strips the body would otherwise leave axios' own
    // untranslated "Request failed with status code 400" on screen.
    mockGetFeed.mockRejectedValue(makeHttpError(400))

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.error.title')).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it('shows a permissions message without a retry button on 403', async () => {
    // The endpoint gate is `view_all_reports` + project access — the same
    // permission the Reports page itself is guarded by, so a 403 here means the
    // user reached the tab without the report permission. Retrying cannot fix it.
    mockGetFeed.mockRejectedValue(makeHttpError(403, { detail: 'Not enough permissions' }))

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.contactTag.error.retry' })
    ).not.toBeInTheDocument()
    // The localized sentence stands alone — the server's English detail is not
    // shown for a 403 (it explains nothing the message does not).
    expect(screen.queryByText('Not enough permissions')).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      mockGetFeed.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(await screen.findByText('pages.reports.contactTag.unavailable')).toBeInTheDocument()
    }
  )

  it.each([
    ['the tag directory is down', 'Tag directory (tag-service) is unavailable'],
    [
      'the tag service is throttling us',
      'throttled by the tag-service rate limit — retry in a minute',
    ],
    ['the keyset walk blew its deadline', 'Tag lookup (tag-service) timed out while paging'],
    [
      'the walk hit its page cap',
      'Tag lookup stopped after 60 pages (300000 clients); raise CONTACT_TAG_FEED_TAG_MAX_PAGES',
    ],
    ['the auth directory is down', 'Employee directory (auth-service) is unavailable'],
    ['the org fan-out blew its deadline', 'Employee directory lookup timed out'],
  ])(
    'shows the localized message ALONE, without the server’s internals, when %s',
    async (_case, detail) => {
      // The backend words these 503s distinctly on purpose — FOUR tag-side
      // flavours (outage, throttling, timeout, page cap) plus the auth-side
      // pair — but it words them for whoever runs the services: they name
      // internal dependencies and env knobs. The operator's move is the same in
      // all six (wait and retry), so the detail buys the reader nothing and
      // leaks the deployment's shape to whoever is looking at the screen.
      // Monitoring tells the six apart from the backend's own logs. Same 503
      // branch as the sibling gap feed.
      mockGetFeed.mockRejectedValue(makeHttpError(503, { detail }))

      renderTab()

      expect(await screen.findByText('pages.reports.contactTag.unavailable')).toBeInTheDocument()
      expect(screen.queryByText(detail)).not.toBeInTheDocument()
      expect(document.body.textContent).not.toContain(detail)
    }
  )

  it('leaks neither a service name nor an env knob from a 503 detail', async () => {
    // The two shapes that make this more than a wording preference: an internal
    // hostname and a configuration variable an operator can neither read nor
    // act on.
    mockGetFeed.mockRejectedValue(
      makeHttpError(503, {
        detail:
          'Tag lookup stopped after 60 pages (300000 clients); raise CONTACT_TAG_FEED_TAG_MAX_PAGES (auth-service)',
      })
    )

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.unavailable')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/CONTACT_TAG_FEED_TAG_MAX_PAGES|auth-service/)
    // ...and the failure is still retryable by hand.
    expect(
      screen.getByRole('button', { name: 'pages.reports.contactTag.error.retry' })
    ).toBeInTheDocument()
  })

  it('shows no detail line for a transient failure that carries no body', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(502))

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it('treats network failures as transient unavailability too', async () => {
    mockGetFeed.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.unavailable')).toBeInTheDocument()
  })

  it('lands a misconfiguration 500 in the generic branch rather than breaking the tab', async () => {
    // "A configured tag code is not defined in the project" is a 500 by design:
    // the request is well formed and the SERVER is misconfigured, so serving a
    // quietly smaller feed would be the failure nobody notices. The FE cannot
    // act on it — generic title, retry offered.
    mockGetFeed.mockRejectedValue(
      makeHttpError(500, { detail: 'Tag codes not defined in project 1: kontakt' })
    )

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.error.title')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'pages.reports.contactTag.error.retry' })
    ).toBeInTheDocument()
  })

  it('does not crash on an unexpected 422 from a hand-crafted request', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(422, { detail: [{ msg: 'bad' }] }))

    renderTab()

    expect(await screen.findByText('pages.reports.contactTag.error.title')).toBeInTheDocument()
  })
})

describe('ContactTag locale keys', () => {
  // The tab renders KEYS in tests (react-i18next is mocked globally), so
  // nothing above would notice a key added to one locale only — these read the
  // actual translation files.
  const uk = ukCommon.pages.reports.contactTag
  const en = enCommon.pages.reports.contactTag

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
    expect(ukCommon.pages.reports.tabs['contact-tag']).toBe('Контакт/Неконтакт')
    expect(enCommon.pages.reports.tabs['contact-tag']).toBe('Contact / No contact')
  })

  it('names the sub-tabs by CODE in the key and by label in the value', () => {
    // The key spelling is the backend's code, so a locale file cannot drift
    // away from what `filterRowsByTagTab` compares against.
    expect(Object.keys(uk.subtabs)).toEqual(['all', 'kontakt', 'nekontakt'])
    expect(Object.keys(en.subtabs)).toEqual(['all', 'kontakt', 'nekontakt'])
    expect(uk.subtabs.kontakt).toBe('Контакт')
    expect(uk.subtabs.nekontakt).toBe('Неконтакт')
  })

  it('interpolates the applied bound rather than spelling a date into the copy', () => {
    // The date comes from the response echo; a locale file quoting one would
    // be a lie the day the backend's offset changes.
    expect(uk.sellToDefaultHint).toContain('{{date}}')
    expect(en.sellToDefaultHint).toContain('{{date}}')
  })

  it('keeps its own copy distinct from the sibling gap feed’s', () => {
    // The two feeds share a column shape, not a vocabulary: a copy-pasted
    // subtree would leave the empty state promising there are no communication
    // gaps over a list about tags.
    const gap = ukCommon.pages.reports.communicationGap
    expect(uk.empty).not.toBe(gap.empty)
    expect(uk.unavailable).not.toBe(gap.unavailable)
    // ...and this feed's own required date has no counterpart there at all.
    expect(uk.viewDate).toBeTruthy()
    expect((gap as Record<string, unknown>).viewDate).toBeUndefined()
  })

  it('says the sub-tabs FILTER the current page, not only that they count it', () => {
    // The strip is a page-scoped filter, not a feed-wide one — the endpoint has
    // no `tag_code` parameter yet (a follow-up carries it). A caveat worded
    // about the counts alone would leave an empty «Неконтакт» tab reading as
    // "none in this feed" while page 2 of ~880 is full of them.
    expect(en.subtabCountScope).toMatch(/filter/i)
    expect(en.subtabCountScope).toMatch(/page/i)
    expect(uk.subtabCountScope).toMatch(/фільтр/i)
    expect(uk.subtabCountScope).toMatch(/сторінк/i)
  })

  it('words the two sale-date "clear" controls as the DIFFERENT actions they are', () => {
    // Both sit in one row of "×" buttons, and they do different things: the
    // lower bound's simply removes a bound, the upper one's switches the
    // backend default OFF. Identical names would be indistinguishable to a
    // screen reader and misleading to everyone else.
    expect(uk.clearSellFrom).not.toBe(uk.clearSellTo)
    expect(en.clearSellFrom).not.toBe(en.clearSellTo)
    expect(uk.disableSellTo).not.toBe(uk.restoreSellToDefault)
  })
})
