import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import i18n from 'i18next'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import enErrors from '@/../public/locales/en/errors.json'
import ukErrors from '@/../public/locales/uk/errors.json'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import { RecordedPaymentsTab } from '../RecordedPaymentsTab'
import { getRecordedPaymentsFeed } from '../../api/recordedPaymentsFeedApi'
import { currentMonthToDateWindow } from '../../lib/currentMonthWindow'
import type {
  OperatorBreakdownLine,
  RecordedPaymentRow,
  RecordedPaymentsFeedResponse,
} from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/recordedPaymentsFeedApi', () => ({
  getRecordedPaymentsFeed: vi.fn(),
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
// component, mirroring the sibling feed tab tests.
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

// The real CheckboxMultiSelect is a Radix dropdown; a `<select multiple>` stub
// exposes the same contract (options, selected, onChange, disabled) so the
// option list and the URL write are assertable without pointer-capture shims.
vi.mock('@/components/ui/CheckboxMultiSelect', () => ({
  CheckboxMultiSelect: ({
    options,
    selected,
    onChange,
    disabled,
    ariaLabel,
    testId,
  }: {
    options: Array<{ value: number; label: string }>
    selected: number[]
    onChange: (next: number[]) => void
    disabled?: boolean
    ariaLabel?: string
    testId?: string
  }) => (
    <select
      multiple
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      value={selected.map(String)}
      onChange={(e) =>
        onChange(Array.from(e.target.selectedOptions).map((option) => Number(option.value)))
      }
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

const mockGetFeed = vi.mocked(getRecordedPaymentsFeed)

function makeRow(overrides: Partial<RecordedPaymentRow> = {}): RecordedPaymentRow {
  return {
    payment_id: 918273,
    client_id: 4711,
    client_is_deleted: false,
    debt_id: 5001,
    contract_number: 'ДГ-12345',
    inn: '1234567890',
    amount: '1500.00',
    payment_date: '2026-08-09',
    payment_confirmation_date: '2026-08-10',
    verified_at: '2026-08-12T07:15:00Z',
    status: 'verified',
    recorded_by_user_id: 201,
    recorded_by_full_name: 'Записенко Іван',
    assigned_user_id: 202,
    assigned_full_name: 'Коваленко Іван',
    client_responsible_user_id: 101,
    client_responsible_full_name: 'Степченко Олена',
    client_responsible_is_service: false,
    purchase_date: '2024-03-15',
    seller_name: 'Acme Co',
    payment_method: 'bank_transfer',
    payment_type: 'F20',
    ...overrides,
  }
}

const SERVICE_LINE: OperatorBreakdownLine = {
  user_id: 6274,
  full_name: 'Договор закрыт',
  is_service: true,
  rows_count: 2637,
  amount: '11605473.83',
}
const OPERATOR_LINE: OperatorBreakdownLine = {
  user_id: 101,
  full_name: 'Степченко Олена',
  is_service: false,
  rows_count: 295,
  amount: '872496.25',
}
const UNRESOLVED_LINE: OperatorBreakdownLine = {
  user_id: null,
  full_name: null,
  is_service: false,
  rows_count: 3,
  amount: '120.00',
}

function makeResponse(
  rows: RecordedPaymentRow[],
  overrides: Partial<RecordedPaymentsFeedResponse> = {}
): RecordedPaymentsFeedResponse {
  return {
    project_id: 1,
    date_from: '2026-08-01',
    date_to: '2026-08-31',
    timezone: 'Europe/Kyiv',
    verified_only: false,
    user_ids: [],
    rows,
    summary: { rows_count: rows.length, total_amount: '1500.00' },
    operator_breakdown: [SERVICE_LINE, OPERATOR_LINE, UNRESOLVED_LINE],
    breakdown_capped: false,
    breakdown_truncated: false,
    total: rows.length,
    page: 1,
    page_size: 50,
    total_pages: rows.length > 0 ? 1 : 0,
    generated_at: '2026-09-29T10:15:31Z',
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

function renderTab(initialEntries: string[] = ['/'], { gcTime }: { gcTime?: number } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, ...(gcTime === undefined ? {} : { gcTime }) } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <RecordedPaymentsTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const search = () => screen.getByTestId('location-search').textContent ?? ''
const verifiedOnlyCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.recordedPayments.verifiedOnly' })
const operatorSelect = () => screen.getByTestId('recorded-payments-operators') as HTMLSelectElement
const breakdownLines = () => screen.getAllByTestId('recorded-payments-breakdown-line')
const lastParams = (): Record<string, unknown> => ({
  ...mockGetFeed.mock.calls[mockGetFeed.mock.calls.length - 1][0],
})
const optionValues = () => Array.from(operatorSelect().options).map((o) => o.value)

/**
 * `getErrorMessage` translates a coded detail through i18next's OWN `t`
 * (not react-i18next's, which the global mock replaces), so the coded-400
 * tests speak Ukrainian through the REAL dictionary: the key, the sentence
 * and its placeholders are read from `public/locales/uk/errors.json`, and a
 * params name the dictionary does not fill leaves `{{…}}` behind — which
 * `translateErrorCode` treats as "untranslated" and falls back to the server
 * text. That is exactly the failure a hardcoded expectation would hide.
 */
function speakUkrainianErrorCodes() {
  const codes = ukErrors.codes as Record<string, string>
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) => {
    const template = key.startsWith('codes.') ? codes[key.slice('codes.'.length)] : undefined
    if (!template) return (options?.defaultValue as string) ?? key
    const values = (options?.replace ?? {}) as Record<string, unknown>
    return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
      name in values ? String(values[name]) : whole
    )
  }) as unknown as typeof i18n.t)
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
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('RecordedPaymentsTab', () => {
  // ==========================================================================
  // The default window — the current month to date, in the PROFILE zone
  // ==========================================================================

  describe('the default window', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
    })

    it('requests the month to date in the profile zone, and pins nothing into the URL', async () => {
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-14T09:00:00Z')) // 12:00, 14 Sep, Kyiv
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      expect(await screen.findByText('ДГ-12345')).toBeInTheDocument()

      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(mockGetFeed).toHaveBeenCalledWith({
        project_id: 1,
        date_from: '2026-09-01',
        date_to: '2026-09-14',
        skip: 0,
        limit: 50,
        timezone: 'Europe/Kyiv',
      })

      // The fields show the default...
      const [dateFrom, dateTo] = dateInputs()
      expect(dateFrom.value).toBe('2026-09-01')
      expect(dateTo.value).toBe('2026-09-14')
      // ...but an auto-derived value is never pinned into the URL, and the
      // backend defaults (all statuses, no operator filter) stay absent too.
      expect(search()).not.toContain('rpf=')
      expect(search()).not.toContain('rpt=')
      expect(search()).not.toContain('rpv=')
      expect(search()).not.toContain('rpu=')
    })

    it('reads the MONTH in the profile timezone, not the browser’s', async () => {
      // 12:00 UTC on 30 September is already 02:00 on 1 OCTOBER in Kiritimati
      // (UTC+14): the operator's month has turned, so the window is the 1st
      // alone. A browser-local resolution would still send September's
      // thirty days — a plausible report for the wrong month.
      authState.user.timezone = 'Pacific/Kiritimati'
      vi.setSystemTime(new Date('2026-09-30T12:00:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('ДГ-12345')

      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2026-10-01',
          date_to: '2026-10-01',
          timezone: 'Pacific/Kiritimati',
        })
      )
    })

    it('derives the browser-zone default from the same rule for a profile without a zone', async () => {
      // No hardcoded day here: the host's zone is whatever CI runs in, so the
      // expectation is computed by the SAME helper from the same "today" —
      // what is pinned is that the tab and the rule agree, and that the zone
      // still travels.
      vi.setSystemTime(new Date('2026-09-14T09:00:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))
      const expected = currentMonthToDateWindow(getDateStringInTimezone(new Date(), null))

      renderTab()
      await screen.findByText('ДГ-12345')

      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: expected?.dateFrom,
          date_to: expected?.dateTo,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      )
    })

    it('rolls the default over on a focus after midnight — into the new month', async () => {
      // Mounted at 23:55 on 30 September (Kyiv), left open, focused again at
      // 00:05 on 1 October: the window is now October's single day, not a
      // stale September plus nothing.
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-30T20:55:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('ДГ-12345')
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-09-01', date_to: '2026-09-30' })
      )

      vi.setSystemTime(new Date('2026-09-30T21:05:00Z'))
      fireEvent(window, new Event('focus'))

      await waitFor(() =>
        expect(mockGetFeed).toHaveBeenLastCalledWith(
          expect.objectContaining({ date_from: '2026-10-01', date_to: '2026-10-01' })
        )
      )
      expect(search()).not.toContain('rpf=')
    })

    it('leaves a user-picked window alone when the day rolls over', async () => {
      authState.user.timezone = 'Europe/Kyiv'
      vi.setSystemTime(new Date('2026-09-30T20:55:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?rpf=2026-08-01&rpt=2026-08-31'])
      await screen.findByText('ДГ-12345')

      vi.setSystemTime(new Date('2026-09-30T21:05:00Z'))
      fireEvent(window, new Event('focus'))
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_from: '2026-08-01', date_to: '2026-08-31' })
      )
    })
  })

  // ==========================================================================
  // URL round-trip and foreign keys
  // ==========================================================================

  it('round-trips every key through the URL (?rpf=&rpt=&rpu=&rpv=&rppg=&rpps=)', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 2, page_size: 100, total_pages: 3 })
    )

    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31&rpu=101,6274&rpv=1&rppg=2&rpps=100'])
    await screen.findByText('ДГ-12345')

    // skip is derived from the ACTIVE page size, not the default one.
    expect(mockGetFeed).toHaveBeenCalledWith({
      project_id: 1,
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      user_ids: [101, 6274],
      verified_only: true,
      skip: 100,
      limit: 100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    const [dateFrom, dateTo] = dateInputs()
    expect(dateFrom.value).toBe('2026-08-01')
    expect(dateTo.value).toBe('2026-08-31')
    expect(verifiedOnlyCheckbox()).toBeChecked()
    // Selected options come back in DOM (option) order, so compare as a set.
    expect(
      Array.from(operatorSelect().selectedOptions)
        .map((o) => o.value)
        .sort()
    ).toEqual(['101', '6274'])
  })

  it('neither consumes nor clobbers the other report tabs’ URL params', async () => {
    // The host page keeps every tab's params in the URL, so this tab renders
    // with the promises feed's (`prf`/`prw`/`prpg` — the `p…` spelling a
    // Payments feed collides with first), the drains feed's (`drf`/`drp`) and
    // the operator-promises tab's (`opf`/`opu`) keys present. None may leak
    // into this tab's request — and writing this tab's own keys must leave
    // them untouched.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([
      '/?tab=recorded-payments&prf=2026-02-02&prw=1&prpg=7&drf=2026-01-01&drp=1&opf=2026-03-03&opu=55',
    ])
    await screen.findByText('ДГ-12345')

    const params = lastParams()
    expect(params.date_from).not.toBe('2026-02-02')
    expect(params.date_from).not.toBe('2026-01-01')
    expect(params.date_from).not.toBe('2026-03-03')
    expect(params.skip).toBe(0)
    expect('verified_only' in params).toBe(false)
    expect('user_ids' in params).toBe(false)

    await userEvent.click(verifiedOnlyCheckbox())
    await waitFor(() => expect(search()).toContain('rpv=1'))

    for (const foreign of [
      'tab=recorded-payments',
      'prf=2026-02-02',
      'prw=1',
      'prpg=7',
      'drf=2026-01-01',
      'drp=1',
      'opf=2026-03-03',
      'opu=55',
    ]) {
      expect(search()).toContain(foreign)
    }
  })

  it('writes a picked date into the URL and resets the page in the same update', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31&rppg=3'])
    await screen.findByText('ДГ-12345')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    fireEvent.change(dateInputs()[0], { target: { value: '2026-08-05' } })

    await waitFor(() => expect(search()).toContain('rpf=2026-08-05'))
    await waitFor(() => expect(search()).not.toContain('rppg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: '2026-08-05', skip: 0 })
      )
    )
  })

  // ==========================================================================
  // «Тільки підтверджені» — a server-side switch, off by default
  // ==========================================================================

  it('lists ALL statuses by default and sends verified_only only once the switch is on', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('ДГ-12345')
    expect('verified_only' in lastParams()).toBe(false)
    expect(verifiedOnlyCheckbox()).not.toBeChecked()

    await userEvent.click(verifiedOnlyCheckbox())

    // A server-side filter: it REFETCHES rather than hiding rows locally
    // (hiding client-side would tear holes in a paginated feed), and pins the
    // choice into the URL.
    await waitFor(() => expect(search()).toContain('rpv=1'))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ verified_only: true }))
  })

  it('drops the key and refetches without it when the switch is cleared', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?rpv=1'])
    await screen.findByText('ДГ-12345')
    expect(verifiedOnlyCheckbox()).toBeChecked()

    await userEvent.click(verifiedOnlyCheckbox())

    // The backend default (off) is the ABSENCE of the key, never `rpv=0`.
    await waitFor(() => expect(search()).not.toContain('rpv='))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
    expect('verified_only' in lastParams()).toBe(false)
  })

  it('resets the page when the switch changes — a filtered feed has different pages', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?rppg=3'])
    await screen.findByText('ДГ-12345')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    await userEvent.click(verifiedOnlyCheckbox())

    await waitFor(() => expect(search()).toContain('rpv=1'))
    await waitFor(() => expect(search()).not.toContain('rppg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ verified_only: true, skip: 0 })
      )
    )
  })

  // ==========================================================================
  // The operator filter — key B, by id, from the breakdown
  // ==========================================================================

  it('offers the breakdown’s operators as the filter options, service line included, null line excluded', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('ДГ-12345')

    const options = Array.from(operatorSelect().options).map((o) => [o.value, o.textContent])
    expect(options).toEqual([
      ['6274', 'Договор закрыт · pages.reports.recordedPayments.serviceBadge'],
      ['101', 'Степченко Олена'],
    ])
  })

  it('applies an operator from the breakdown as the filter — `rpu`, user_ids, page reset', async () => {
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], { user_ids: [101], operator_breakdown: [OPERATOR_LINE] })
      )

    renderTab(['/?rppg=3'])
    await screen.findByText('ДГ-12345')

    // The second line is Степченко's (the first is the service account).
    await userEvent.click(within(breakdownLines()[1]).getByRole('button'))

    await waitFor(() => expect(search()).toContain('rpu=101'))
    await waitFor(() => expect(search()).not.toContain('rppg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ user_ids: [101], skip: 0 })
      )
    )
    // From page 3 the tab had never fetched page 1 unfiltered, so the option
    // list costs one request of its own here — the only case it does.
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(3))
    expect(mockGetFeed).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ user_ids: expect.anything() })
    )
    expect(lastParams()).toMatchObject({ skip: 0 })
  })

  it('keeps the whole option list after a filtered answer, and clears the filter as one URL update', async () => {
    // A filtered response carries only the filtered operator's line; the
    // multi-select subscribes to the unfiltered answer for the same window
    // so the operator can pick ANOTHER one without clearing first.
    mockGetFeed
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockResolvedValue(
        makeResponse([makeRow()], { user_ids: [101], operator_breakdown: [OPERATOR_LINE] })
      )

    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31'])
    await screen.findByText('ДГ-12345')

    // The second line is Степченко's (the first is the service account).
    await userEvent.click(within(breakdownLines()[1]).getByRole('button'))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))

    // Both operators are still offered; the active one is marked.
    expect(Array.from(operatorSelect().options).map((o) => o.value)).toEqual(['6274', '101'])
    expect(breakdownLines().some((line) => line.getAttribute('data-active') === 'true')).toBe(true)

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.recordedPayments.breakdown.clearFilter' })
    )
    await waitFor(() => expect(search()).not.toContain('rpu='))
    await waitFor(() =>
      expect(breakdownLines().every((line) => !line.hasAttribute('data-active'))).toBe(true)
    )
    // No third request: the unfiltered answer is still fresh (60 s) under the
    // key the clear returns to, so React Query serves it from the cache. Nor
    // was there one for the OPTIONS: the options query's key is the very
    // request the click came from, deduped, not fetched again.
    expect(mockGetFeed).toHaveBeenCalledTimes(2)
  })

  it('renders the breakdown block from the answer the summary came from — the unfiltered answer feeds the options only', async () => {
    // The filtered answer carries one line, with DIFFERENT numbers from the
    // unfiltered answer's line for the same operator (a payment confirmed in
    // between). The block and the summary above it must be one response:
    // 296 next to 296, never a cached 295 under a fresh 296.
    mockGetFeed.mockResolvedValueOnce(makeResponse([makeRow()])).mockResolvedValue(
      makeResponse([makeRow()], {
        user_ids: [101],
        summary: { rows_count: 296, total_amount: '873996.25' },
        operator_breakdown: [{ ...OPERATOR_LINE, rows_count: 296, amount: '873996.25' }],
      })
    )

    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31'])
    await screen.findByText('ДГ-12345')

    await userEvent.click(within(breakdownLines()[1]).getByRole('button'))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))

    // The block: the filtered answer's one line, with ITS numbers…
    await waitFor(() => expect(breakdownLines()).toHaveLength(1))
    expect(within(breakdownLines()[0]).getByText('296')).toBeInTheDocument()
    expect(within(breakdownLines()[0]).queryByText('295')).not.toBeInTheDocument()
    // …while the options still come from the whole list.
    expect(Array.from(operatorSelect().options).map((o) => o.value)).toEqual(['6274', '101'])
  })

  it('offers, under «Тільки підтверджені», the operators of the VERIFIED unfiltered answer — the options query’s key carries the switch', async () => {
    // Three answers for one window: the unfiltered list (both operators),
    // the unfiltered list with the switch on (the service account has
    // nothing verified), then the filtered one. The options must come from
    // the second, never the first: same window, different switch, a
    // different set of operators. Both unfiltered answers sit in the cache;
    // an options key without the switch would resolve to the first.
    mockGetFeed
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockResolvedValueOnce(
        makeResponse([makeRow()], {
          verified_only: true,
          operator_breakdown: [{ ...OPERATOR_LINE, rows_count: 200 }],
        })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], {
          verified_only: true,
          user_ids: [101],
          operator_breakdown: [{ ...OPERATOR_LINE, rows_count: 120 }],
        })
      )

    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31'])
    await screen.findByText('ДГ-12345')

    await userEvent.click(verifiedOnlyCheckbox())
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(Array.from(operatorSelect().options).map((o) => o.value)).toEqual(['101'])
    )

    await userEvent.click(within(breakdownLines()[0]).getByRole('button'))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(within(breakdownLines()[0]).getByText('120')).toBeInTheDocument())
    expect(Array.from(operatorSelect().options).map((o) => o.value)).toEqual(['101'])
  })

  it('offers, after a window change, the operators of the NEW window — the options query’s key carries the window', async () => {
    // Same shape: the old window's unfiltered answer (both operators) stays
    // in the cache when the window shrinks to one where only Степченко
    // collected. An options key without the window would offer, and the
    // block would show, the OLD window's breakdown under the new window's
    // summary.
    mockGetFeed
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockResolvedValueOnce(
        makeResponse([makeRow()], {
          date_to: '2026-08-15',
          operator_breakdown: [{ ...OPERATOR_LINE, rows_count: 200 }],
        })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], {
          date_to: '2026-08-15',
          user_ids: [101],
          operator_breakdown: [{ ...OPERATOR_LINE, rows_count: 120 }],
        })
      )

    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31'])
    await screen.findByText('ДГ-12345')

    fireEvent.change(dateInputs()[1], { target: { value: '2026-08-15' } })
    await waitFor(() => expect(search()).toContain('rpt=2026-08-15'))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(Array.from(operatorSelect().options).map((o) => o.value)).toEqual(['101'])
    )

    await userEvent.click(within(breakdownLines()[0]).getByRole('button'))
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(within(breakdownLines()[0]).getByText('120')).toBeInTheDocument())
    expect(Array.from(operatorSelect().options).map((o) => o.value)).toEqual(['101'])
    expect(screen.queryByText('2,637')).not.toBeInTheDocument()
  })

  it('keeps a selected operator absent from the list selectable under its id', async () => {
    // A shared link with `rpu` set answers with that operator's line only —
    // or with none, when they collected nothing. The selection must stay
    // visible and untickable either way.
    mockGetFeed.mockResolvedValue(makeResponse([], { user_ids: [999], operator_breakdown: [] }))

    renderTab(['/?rpu=999'])
    await screen.findByText('pages.reports.recordedPayments.empty')

    expect(Array.from(operatorSelect().options).map((o) => [o.value, o.textContent])).toEqual([
      ['999', '999'],
    ])
    expect(Array.from(operatorSelect().selectedOptions).map((o) => o.value)).toEqual(['999'])
  })

  it('keeps every operator of the window on offer after the unfiltered answer was garbage-collected — the options are a SUBSCRIBED query', async () => {
    // gcTime 0: a cache entry nobody observes is dropped on the next tick.
    // The unfiltered answer loses its observer the moment the filter is
    // applied (the main query moves to the filtered key), so an UNSUBSCRIBED
    // read of the cache — the design this replaced — finds nothing on the
    // next recompute, here a page change, and the list collapses to the
    // selected operator: nobody can pick another one. The options query
    // observes that key for as long as the filter is on, so the entry stays.
    mockGetFeed.mockImplementation(async (params) =>
      params.user_ids
        ? makeResponse([makeRow({ contract_number: params.skip ? 'ДГ-99999' : 'ДГ-12345' })], {
            user_ids: [101],
            operator_breakdown: [OPERATOR_LINE],
            total: 130,
            page: params.skip ? 2 : 1,
            page_size: 50,
            total_pages: 3,
          })
        : makeResponse([makeRow()])
    )

    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31'], { gcTime: 0 })
    await screen.findByText('ДГ-12345')

    await userEvent.click(within(breakdownLines()[1]).getByRole('button'))
    await waitFor(() => expect(breakdownLines()).toHaveLength(1))
    await waitFor(() => expect(optionValues()).toEqual(['6274', '101']))
    expect(mockGetFeed).toHaveBeenCalledTimes(2)

    // Let the gc tick pass before the next recompute.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    await userEvent.click(screen.getByTitle('2'))
    await screen.findByText('ДГ-99999')
    expect(optionValues()).toEqual(['6274', '101'])
    // Paging under the filter cost ONE request: the options key has no page
    // in it, so the page change did not touch it.
    expect(mockGetFeed).toHaveBeenCalledTimes(3)
  })

  it('sends ONE request without an operator filter — the options query is not enabled', async () => {
    // On page 2 the main key (skip 50) and the options key (skip 0) differ,
    // so an options query enabled without a filter would show up here as a
    // second request. With none, the main answer IS the unfiltered one.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 2, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?rppg=2'])
    await screen.findByText('ДГ-12345')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(lastParams()).toMatchObject({ skip: 50 })
    expect(lastParams()).not.toHaveProperty('user_ids')
    expect(optionValues()).toEqual(['6274', '101'])
  })

  it('follows the window and the switch under a filter — the options query’s key carries both', async () => {
    // One fixture, keyed on the request: the unfiltered list of each window
    // and switch is a different set of operators, the filtered answer is
    // always the selected one's line. Every set contains 101 (selected), so
    // a list that merely kept the selection would not tell them apart —
    // the OTHER operator does.
    const THIRD: OperatorBreakdownLine = {
      user_id: 303,
      full_name: 'Третяк Ігор',
      is_service: false,
      rows_count: 12,
      amount: '3000.00',
    }
    const FOURTH: OperatorBreakdownLine = {
      user_id: 404,
      full_name: 'Четвертак Ніна',
      is_service: false,
      rows_count: 7,
      amount: '700.00',
    }
    mockGetFeed.mockImplementation(async (params) => {
      const lines = params.verified_only
        ? [OPERATOR_LINE, FOURTH]
        : params.date_to === '2026-08-15'
          ? [OPERATOR_LINE, THIRD]
          : [SERVICE_LINE, OPERATOR_LINE, UNRESOLVED_LINE]
      return makeResponse([makeRow()], {
        date_to: params.date_to,
        verified_only: !!params.verified_only,
        user_ids: params.user_ids ?? [],
        operator_breakdown: params.user_ids ? lines.filter((l) => l.user_id === 101) : lines,
      })
    })

    // A shared link WITH the filter: the filtered answer and the unfiltered
    // list are both requested, and the list offers the whole window.
    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31&rpu=101'])
    await screen.findByText('ДГ-12345')
    await waitFor(() => expect(optionValues()).toEqual(['6274', '101']))
    expect(mockGetFeed).toHaveBeenCalledTimes(2)
    const unfilteredCalls = () =>
      mockGetFeed.mock.calls.map(([params]) => params).filter((params) => !params.user_ids)
    expect(unfilteredCalls()).toEqual([
      expect.objectContaining({ date_from: '2026-08-01', date_to: '2026-08-31', skip: 0 }),
    ])
    expect(unfilteredCalls()[0]).not.toHaveProperty('verified_only')
    // Only the selected operator's line in the block itself.
    expect(breakdownLines()).toHaveLength(1)

    // The window shrinks: the NEW window's operators, requested unfiltered.
    fireEvent.change(dateInputs()[1], { target: { value: '2026-08-15' } })
    await waitFor(() => expect(optionValues()).toEqual(['101', '303']))
    expect(mockGetFeed).toHaveBeenCalledTimes(4)
    expect(unfilteredCalls()[1]).toEqual(
      expect.objectContaining({ date_to: '2026-08-15', skip: 0 })
    )

    // The switch goes on: the VERIFIED operators of that window.
    await userEvent.click(verifiedOnlyCheckbox())
    await waitFor(() => expect(optionValues()).toEqual(['101', '404']))
    expect(mockGetFeed).toHaveBeenCalledTimes(6)
    expect(unfilteredCalls()[2]).toEqual(
      expect.objectContaining({ date_to: '2026-08-15', verified_only: true, skip: 0 })
    )
    // The block is still the filtered answer's, with the current key.
    expect(breakdownLines()).toHaveLength(1)
  })

  it('names the selected operator from the filtered answer while the unfiltered list is unavailable', async () => {
    // The unfiltered request fails, the filtered one does not: the tab is
    // not in its error state, the multi-select shows the selected operator
    // by NAME (the filtered answer's line), and the selection stays
    // untickable.
    mockGetFeed.mockImplementation(async (params) => {
      if (!params.user_ids) throw makeHttpError(503, { detail: 'employee directory unavailable' })
      return makeResponse([makeRow()], { user_ids: [101], operator_breakdown: [OPERATOR_LINE] })
    })

    renderTab(['/?rpu=101'])
    await screen.findByText('ДГ-12345')
    await waitFor(() => expect(mockGetFeed).toHaveBeenCalledTimes(2))

    expect(Array.from(operatorSelect().options).map((o) => [o.value, o.textContent])).toEqual([
      ['101', 'Степченко Олена'],
    ])
    expect(Array.from(operatorSelect().selectedOptions).map((o) => o.value)).toEqual(['101'])
    expect(
      screen.queryByRole('button', { name: 'pages.reports.recordedPayments.error.retry' })
    ).not.toBeInTheDocument()
  })

  it('writes a multi-select change as a comma list and sends it as user_ids', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('ДГ-12345')

    await userEvent.selectOptions(operatorSelect(), ['6274', '101'])

    await waitFor(() => expect(search()).toMatch(/rpu=6274(,|%2C)101/))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ user_ids: [6274, 101] })
      )
    )
  })

  it.each([
    ['a non-numeric id', '/?rpu=abc', 'pages.reports.recordedPayments.operatorsInvalid'],
    ['a zero id', '/?rpu=0', 'pages.reports.recordedPayments.operatorsInvalid'],
    [
      'more ids than the backend accepts',
      `/?rpu=${Array.from({ length: 201 }, (_, i) => i + 1).join(',')}`,
      'pages.reports.recordedPayments.operatorsTooMany',
    ],
  ])(
    'refuses a hand-edited operator list with %s instead of sending it',
    async (_c, entry, key) => {
      // The backend would answer 400 (USER_IDS_OUT_OF_RANGE / USER_IDS_TOO_MANY)
      // or 422; the tab says so in words and sends nothing.
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab([entry])

      expect(await screen.findByText(key)).toBeInTheDocument()
      expect(mockGetFeed).not.toHaveBeenCalled()
    }
  )

  // ==========================================================================
  // The breakdown block
  // ==========================================================================

  it('renders every breakdown line — the service line flagged, the null line unfilterable', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('ДГ-12345')

    const lines = breakdownLines()
    expect(lines).toHaveLength(3)
    // The service account is an ORDINARY line with a badge — never hidden,
    // never merged; the lines still add up to the summary.
    expect(lines[0]).toHaveAttribute('data-service', 'true')
    expect(within(lines[0]).getByText('Договор закрыт')).toBeInTheDocument()
    expect(
      within(lines[0]).getByText('pages.reports.recordedPayments.serviceBadge')
    ).toBeInTheDocument()
    expect(within(lines[0]).getByText('2,637')).toBeInTheDocument()
    expect(within(lines[0]).getByText('11,605,473.83')).toBeInTheDocument()
    expect(lines[1]).not.toHaveAttribute('data-service')
    expect(within(lines[1]).getByText('295')).toBeInTheDocument()
    // The unresolved line has no id: plain text, no filter button.
    expect(
      within(lines[2]).getByText('pages.reports.recordedPayments.breakdown.unresolved')
    ).toBeInTheDocument()
    expect(within(lines[2]).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('recorded-payments-breakdown-capped')).not.toBeInTheDocument()
    expect(screen.queryByTestId('recorded-payments-breakdown-truncated')).not.toBeInTheDocument()
  })

  it('shows the capped notice INSTEAD of lines, and disables the operator filter', async () => {
    // Past the distinct-client cap the backend serves an EMPTY breakdown and
    // refuses `user_ids` with 400 — an empty table would read as "nobody
    // collected anything", and offering the filter would only produce the 400.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { operator_breakdown: [], breakdown_capped: true })
    )

    renderTab()
    await screen.findByText('ДГ-12345')

    expect(screen.getByTestId('recorded-payments-breakdown-capped')).toHaveTextContent(
      'pages.reports.recordedPayments.breakdown.capped'
    )
    expect(screen.queryAllByTestId('recorded-payments-breakdown-line')).toHaveLength(0)
    expect(
      screen.queryByText('pages.reports.recordedPayments.breakdown.empty')
    ).not.toBeInTheDocument()
    expect(operatorSelect()).toBeDisabled()
    // The rows and the summary are still served and still shown.
    expect(screen.getByTestId('recorded-payments-summary')).toBeInTheDocument()
  })

  it('shows the truncated notice ABOVE the lines it still has', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { breakdown_truncated: true }))

    renderTab()
    await screen.findByText('ДГ-12345')

    expect(screen.getByTestId('recorded-payments-breakdown-truncated')).toHaveTextContent(
      'pages.reports.recordedPayments.breakdown.truncated'
    )
    expect(breakdownLines()).toHaveLength(3)
  })

  // ==========================================================================
  // The table through the tab
  // ==========================================================================

  it('renders the row with both confirmation dates, the money and the status', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('ДГ-12345')).toBeInTheDocument()
    expect(screen.getByText('1234567890')).toBeInTheDocument()
    // The bank date (the window's anchor) as a bare day…
    expect(screen.getByText('10-08-2026')).toBeInTheDocument()
    // …and the CRM instant in the PROFILE zone, with its time.
    expect(screen.getByText('12-08-2026 10:15')).toBeInTheDocument()
    expect(screen.getByText('09-08-2026')).toBeInTheDocument()
    expect(screen.getByText('15-03-2024')).toBeInTheDocument()
    expect(screen.getByText('Acme Co')).toBeInTheDocument()
    expect(screen.getByText('bank_transfer')).toBeInTheDocument()
    expect(screen.getByText('F20')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.recordedPayments.status.verified')).toHaveAttribute(
      'data-status',
      'verified'
    )
    expect(
      screen.getByRole('link', { name: 'pages.reports.recordedPayments.openClient' })
    ).toHaveAttribute('href', '/dashboard/clients/4711')
    expect(screen.getByTestId('recorded-payments-summary')).toBeInTheDocument()
  })

  it('folds «Відповідальний за платіж» by ID: a soft-deleted assignee shows the assignee’s id, not the recorder', async () => {
    // The directory filters soft-deleted users, so the assignee's NAME is
    // null while the id stays. A name fold would print the recorder's name
    // («Записенко Іван») in this column — a different person.
    mockGetFeed.mockResolvedValue(
      makeResponse([
        makeRow({
          assigned_user_id: 4711,
          assigned_full_name: null,
          recorded_by_user_id: 201,
          recorded_by_full_name: 'Записенко Іван',
        }),
      ])
    )

    renderTab()
    await screen.findByText('ДГ-12345')

    // The link's accessible name is its sr-only sentence (the key, under the
    // mocked `t`); the visible id is what the eye gets.
    const link = screen.getByText('4711').closest('a')
    expect(link).toHaveAttribute('data-user-id', '4711')
    // The recorder's name appears exactly once — in ITS column, «Додав
    // оплату» — and never as the payment's responsible.
    expect(screen.getAllByText('Записенко Іван')).toHaveLength(1)
    expect(screen.getByText('Записенко Іван').closest('a')).toBeNull()
  })

  it('links the payment’s responsible to the operator-promises tab with the SAME window and opu', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { date_from: '2026-08-01', date_to: '2026-08-31' })
    )

    renderTab(['/?tab=recorded-payments&rpf=2026-08-01&rpt=2026-08-31&rpv=1&opd=d17'])
    await screen.findByText('ДГ-12345')

    const href = screen.getByText('Коваленко Іван').closest('a')?.getAttribute('href') ?? ''
    expect(href.startsWith('/dashboard/reports?')).toBe(true)
    const params = new URLSearchParams(href.slice(href.indexOf('?')))
    expect(params.get('tab')).toBe('operator-promises')
    expect(params.get('opu')).toBe('202')
    expect(params.get('opf')).toBe('2026-08-01')
    expect(params.get('opt')).toBe('2026-08-31')
    // This tab's own state rides along (Back lands on the same list) and the
    // target's department sub-tab is dropped so «Всі» shows the row.
    expect(params.get('rpf')).toBe('2026-08-01')
    expect(params.get('rpv')).toBe('1')
    expect(params.has('opd')).toBe(false)
  })

  it('links a breakdown line to the operator-promises tab as well', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('ДГ-12345')

    const lineLink = within(breakdownLines()[1]).getByRole('link', {
      name: 'pages.reports.recordedPayments.operatorPromisesLink',
    })
    const params = new URLSearchParams((lineLink.getAttribute('href') ?? '').replace(/^[^?]*/, ''))
    expect(params.get('opu')).toBe('101')
    expect(params.get('opf')).toBe('2026-08-01')
    expect(params.get('opt')).toBe('2026-08-31')
  })

  it('shows the calm empty state (and no pager) for a window without payments', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([], { total: 0, total_pages: 0 }))

    renderTab()

    expect(await screen.findByText('pages.reports.recordedPayments.empty')).toBeInTheDocument()
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
  })

  it('marks previous rows as busy while a new page is loading', async () => {
    let resolveSecond: (value: RecordedPaymentsFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<RecordedPaymentsFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('ДГ-12345')

    await userEvent.click(screen.getByTitle('2'))

    expect(await screen.findByTestId('recorded-payments-refreshing')).toBeInTheDocument()
    await waitFor(() => expect(search()).toContain('rppg=2'))

    resolveSecond(
      makeResponse([makeRow({ contract_number: 'ДГ-99999' })], {
        total: 130,
        page: 2,
        page_size: 50,
        total_pages: 3,
      })
    )

    expect(await screen.findByText('ДГ-99999')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('recorded-payments-refreshing')).not.toBeInTheDocument()
    )
  })

  // ==========================================================================
  // Window validation — nothing invalid reaches the API
  // ==========================================================================

  it.each([
    ['a day the month does not have', '/?rpf=2026-02-31', 0],
    ['a month that does not exist', '/?rpt=2026-13-01', 1],
  ])('blocks a hand-edited bound with %s', async (_case, entry, offendingIndex) => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(
      await screen.findByText('pages.reports.recordedPayments.invalidDate')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
    const fields = dateInputs()
    expect(fields[offendingIndex]).toHaveAttribute('aria-invalid', 'true')
    expect(fields[1 - offendingIndex]).not.toHaveAttribute('aria-invalid')
    expect(fields[offendingIndex].value).toBe('')
  })

  it('blocks an inverted window and recovers once a bound is repicked', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?rpf=2026-08-20&rpt=2026-08-10'])

    expect(
      await screen.findByText('pages.reports.recordedPayments.invalidRange')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    fireEvent.change(dateInputs()[1], { target: { value: '2026-08-25' } })

    expect(await screen.findByText('ДГ-12345')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-08-20', date_to: '2026-08-25' })
    )
  })

  it('mirrors the backend’s 366-day cap instead of letting it answer 400', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?rpf=2026-01-01&rpt=2027-01-03'])

    expect(
      await screen.findByText('pages.reports.recordedPayments.rangeTooLong')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
  })

  it('lets the widest allowed window — exactly a 366-day difference — through', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?rpf=2026-01-01&rpt=2027-01-02'])
    await screen.findByText('ДГ-12345')

    expect(
      screen.queryByText('pages.reports.recordedPayments.rangeTooLong')
    ).not.toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-01-01', date_to: '2027-01-02' })
    )
  })

  it('bounds neither picker by the other — no min/max on either field', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?rpf=2026-08-01&rpt=2026-08-31'])
    await screen.findByText('ДГ-12345')

    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('data-min')
      expect(field).not.toHaveAttribute('data-max')
    }
  })

  // ==========================================================================
  // Pagination
  // ==========================================================================

  it('heals a stale ?rppg= down to the last page the answer still has', async () => {
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 })
      )

    renderTab(['/?rppg=5'])

    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 200 }))
    )
    await waitFor(() => expect(search()).toContain('rppg=2'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 50, limit: 50 }))
    )
    expect(await screen.findByText('ДГ-12345')).toBeInTheDocument()
  })

  it('never offers a page size above this endpoint’s 200-row cap', async () => {
    // The client-service feeds accept 500; this one refuses over 200 with a
    // 422. Every selectable size — and the size read from a hand-edited
    // URL — stays under it.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?rpps=500'])
    await screen.findByText('ДГ-12345')

    const limit = lastParams().limit as number
    expect(limit).toBeLessThanOrEqual(200)
  })

  // ==========================================================================
  // The error ladder
  // ==========================================================================

  it('shows a permissions message without a retry button on 403', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(403))

    renderTab()

    expect(await screen.findByText('pages.reports.recordedPayments.forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.recordedPayments.error.retry' })
    ).not.toBeInTheDocument()
  })

  it.each([
    [
      'USER_IDS_TOO_MANY',
      { max_ids: 200 },
      'user_ids may hold at most 200 ids',
      'Можна вибрати не більше 200 операторів',
    ],
    [
      'USER_IDS_OUT_OF_RANGE',
      { min: 1, max: 2147483647 },
      'user_ids must be within 1..2147483647',
      'Ідентифікатор оператора має бути в межах від 1 до 2147483647',
    ],
    [
      'BREAKDOWN_WINDOW_TOO_WIDE',
      { max_clients: 20000 },
      'the window holds more than 20000 distinct clients; user_ids cannot be resolved',
      'У вибраному періоді понад 20000 клієнтів — фільтр за операторами недоступний. Звузьте період.',
    ],
  ])(
    'localises the coded 400 %s with its params, never the server’s English',
    async (code, params, detail, expected) => {
      // The three codes this endpoint adds to the family (see the contract's
      // error ladder). Read through the REAL uk dictionary, so a missing key
      // or a renamed placeholder (`max_ids` → `max`) fails here rather than
      // leaving the server's sentence on an operator's screen.
      speakUkrainianErrorCodes()
      mockGetFeed.mockRejectedValue(makeHttpError(400, { detail, code, params }))

      renderTab()

      expect(await screen.findByText(expected)).toBeInTheDocument()
      expect(screen.queryByText(detail)).not.toBeInTheDocument()
    }
  )

  it('shows the family’s DATE_RANGE_TOO_LONG localised too', async () => {
    speakUkrainianErrorCodes()
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, {
        detail: 'Date range must not exceed 366 days',
        code: 'DATE_RANGE_TOO_LONG',
        params: { max_days: 366 },
      })
    )

    renderTab()

    expect(
      await screen.findByText('Діапазон дат не може перевищувати 366 днів')
    ).toBeInTheDocument()
  })

  it('shows an uncoded 400 detail verbatim', async () => {
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, { detail: "Unknown IANA timezone: 'Mars/Olympus'" })
    )

    renderTab()

    expect(await screen.findByText(/Unknown IANA timezone/)).toBeInTheDocument()
  })

  it('falls back to the localized title for a 400 whose body never arrived', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(400))

    renderTab()

    expect(
      await screen.findByText('pages.reports.recordedPayments.error.title')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the unavailability message on transient %d errors',
    async (status) => {
      mockGetFeed.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(
        await screen.findByText('pages.reports.recordedPayments.unavailable')
      ).toBeInTheDocument()
    }
  )

  it('shows the directory 503 detail under the localized message', async () => {
    // The details name WHICH dependency failed; that is why they are shown.
    mockGetFeed.mockRejectedValue(
      makeHttpError(503, {
        detail:
          'Client directory (client-service) is unavailable; the feed cannot be rendered safely',
      })
    )

    renderTab()

    expect(
      await screen.findByText('pages.reports.recordedPayments.unavailable')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Client directory \(client-service\) is unavailable/)
    ).toBeInTheDocument()
  })

  it('treats network failures as transient unavailability, with no detail line', async () => {
    mockGetFeed.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(
      await screen.findByText('pages.reports.recordedPayments.unavailable')
    ).toBeInTheDocument()
    expect(screen.queryByText('ERR_NETWORK')).not.toBeInTheDocument()
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetFeed
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(
      await screen.findByText('pages.reports.recordedPayments.error.title')
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.recordedPayments.error.retry' })
    )

    expect(await screen.findByText('ДГ-12345')).toBeInTheDocument()
  })
})

describe('RecordedPayments locale keys', () => {
  // The tab renders KEYS in tests (react-i18next is mocked globally), so
  // nothing above would notice a key added to one locale only — these read
  // the actual translation files.
  const uk = ukCommon.pages.reports.recordedPayments
  const en = enCommon.pages.reports.recordedPayments

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
    expect(ukCommon.pages.reports.tabs['recorded-payments']).toBe('Внесені платежі')
    expect(enCommon.pages.reports.tabs['recorded-payments']).toBe('Recorded payments')
  })

  it('translates the three new error codes in both locales with the backend’s param names', () => {
    // The params are the contract's (`max_ids`, `min`/`max`, `max_clients`):
    // a placeholder spelled differently is a sentence with `{{…}}` in it,
    // which `translateErrorCode` refuses and falls back to English for.
    const expected: Record<string, string[]> = {
      USER_IDS_TOO_MANY: ['max_ids'],
      USER_IDS_OUT_OF_RANGE: ['max', 'min'],
      BREAKDOWN_WINDOW_TOO_WIDE: ['max_clients'],
    }
    for (const dictionary of [ukErrors.codes, enErrors.codes] as Array<Record<string, string>>) {
      for (const [code, params] of Object.entries(expected)) {
        const sentence = dictionary[code]
        expect(sentence, code).toBeTruthy()
        const placeholders = [...sentence.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()
        expect(placeholders, code).toEqual(params)
      }
    }
  })

  it('keeps the verified switch worded as a POSITIVE filter, not a "hide"', () => {
    // The source system's «Только подтверждённые» — the switch INCLUDES
    // verified rows only; a "hide cancelled" label would invert the reader's
    // model of the default (all statuses).
    expect(uk.verifiedOnly).not.toMatch(/^Приховати/)
    expect(en.verifiedOnly).not.toMatch(/^Hide/i)
  })
})
