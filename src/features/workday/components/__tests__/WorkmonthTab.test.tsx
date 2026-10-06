/**
 * «Робочий місяць з розривами» rendered from the PR 6 contract mocks, the
 * month-not-ready state, and the days modal (flags, hidden out-of-window days).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { expectObscured } from '@/test/piiHelpers'
import { WorkmonthTab } from '../WorkmonthTab'
import { WORKDAY_RED_ROW_CLASS } from '../WorkdayTable'
import { getWorkmonthDays, getWorkmonthReport } from '../../api/workdayApi'
import {
  ERROR_MOCKS,
  httpError,
  mockWorkmonth,
  mockWorkmonthDays,
  mockWorkmonthFutureEmpty,
} from '../../__tests__/contractMocks'

vi.mock('../../api/workdayApi', () => ({
  getWorkdayReport: vi.fn(),
  getWorkdayBreaks: vi.fn(),
  getWorkmonthReport: vi.fn(),
  getWorkmonthDays: vi.fn(),
}))

const authState = {
  user: { active_project_id: 1, projects: [{ id: 1 }], timezone: null as string | null },
}
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authState),
}))

vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    label,
    error,
  }: {
    value?: string | Date | null
    label?: string
    error?: string
  }) => (
    <>
      <input
        data-testid="date-select"
        aria-label={label}
        readOnly
        value={typeof value === 'string' ? value : ''}
      />
      {error && <span role="alert">{error}</span>}
    </>
  ),
}))

const mockGetMonth = vi.mocked(getWorkmonthReport)
const mockGetDays = vi.mocked(getWorkmonthDays)

function renderTab(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <WorkmonthTab />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
const cellsOf = (name: string) =>
  Array.from(rowOf(name).querySelectorAll('td')).map((td) => td.textContent ?? '')
const classesOf = (element: HTMLElement) => element.className.split(/\s+/).filter(Boolean)
const RED_TOKENS = WORKDAY_RED_ROW_CLASS.split(' ')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WorkmonthTab — rendering the contract mock', () => {
  describe('default month (no `wm`)', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it.each([
      ['any day but the 1st → the current month', '2026-10-06T09:00:00Z', '2026-10'],
      ['the last day → the current month', '2026-10-31T09:00:00Z', '2026-10'],
      ['the 1st → the previous month', '2026-10-01T09:00:00Z', '2026-09'],
      // 22:30 UTC on 30.09 is already 01:30 on 1.10 in Kyiv: the KYIV day decides.
      ['the 1st in Kyiv while still the 30th in UTC', '2026-09-30T22:30:00Z', '2026-09'],
      // …and the other way round: still the 1st in UTC, already the 2nd in Kyiv.
      ['the 2nd in Kyiv while still the 1st in UTC', '2026-10-01T22:30:00Z', '2026-10'],
      ['1 January → December of the previous year', '2027-01-01T09:00:00Z', '2026-12'],
    ])('%s', async (_case, now, expected) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(now))
      mockGetMonth.mockResolvedValue(mockWorkmonth())
      renderTab()
      await screen.findByText('Петренко Андрій Сергійович')

      expect(mockGetMonth).toHaveBeenCalledWith({ project_id: 1, month: expected })
    })
  })

  it('PII: operator names only inside data-openreplay-obscured, never in an attribute', async () => {
    mockGetMonth.mockResolvedValue(mockWorkmonth())
    mockGetDays.mockResolvedValue(mockWorkmonthDays())
    renderTab(['/?wm=2026-10'])
    await userEvent.click(await screen.findByText('Петренко Андрій Сергійович'))
    await screen.findByTestId('workmonth-days')

    const fios = [
      'Шевчук Дмитро Олегович',
      'Іваненко Олена Петрівна',
      'Петренко Андрій Сергійович',
      'Коваль Марія Іванівна',
    ]
    // Table row + modal heading for the opened operator.
    expect(screen.getAllByText('Петренко Андрій Сергійович')).toHaveLength(2)
    for (const name of fios) for (const node of screen.getAllByText(name)) expectObscured(node)
    const leaks: string[] = []
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      for (const attr of Array.from(element.attributes)) {
        if (fios.some((name) => attr.value.includes(name))) leaks.push(element.tagName)
      }
    }
    expect(leaks).toEqual([])
  })

  it('renders totals in hours / minutes and the average per active day', async () => {
    mockGetMonth.mockResolvedValue(mockWorkmonth())
    renderTab(['/?wm=2026-10'])
    await screen.findByText('Петренко Андрій Сергійович')

    // 87913 s → 24.4 h; 9 breaks; 12584 s → 210 min; 2950 s → 49 min; 3 days;
    // average 4195 s → 70 min.
    expect(cellsOf('Петренко Андрій Сергійович')).toEqual([
      expect.stringContaining('Петренко Андрій Сергійович'),
      'Стягнення',
      'Стягнення-2',
      '24.4',
      '9',
      '210',
      '49',
      '3',
      '70',
    ])
  })

  it('a weekend-only operator has a zero row and «—» as the average (null, not 0)', async () => {
    mockGetMonth.mockResolvedValue(mockWorkmonth())
    renderTab(['/?wm=2026-10'])
    await screen.findByText('Шевчук Дмитро Олегович')

    expect(cellsOf('Шевчук Дмитро Олегович').slice(3)).toEqual(['0.0', '0', '0', '0', '0', '—'])
  })

  it('red rows follow `is_red` from the answer; the legend threshold comes from meta', async () => {
    const answer = mockWorkmonth()
    answer.rows[2].is_red = true
    answer.meta.red_threshold_seconds = 3000
    mockGetMonth.mockResolvedValue(answer)
    renderTab(['/?wm=2026-10'])
    await screen.findByText('Петренко Андрій Сергійович')

    expect(classesOf(rowOf('Петренко Андрій Сергійович'))).toEqual(
      expect.arrayContaining(RED_TOKENS)
    )
    expect(classesOf(rowOf('Іваненко Олена Петрівна'))).not.toEqual(
      expect.arrayContaining(RED_TOKENS)
    )
    expect(screen.getByTestId('workmonth-legend')).toHaveTextContent(
      'pages.reports.workmonth.legend:50'
    )
  })

  it('says that department and group are the current ones (contract decision 5)', async () => {
    mockGetMonth.mockResolvedValue(mockWorkmonth())
    renderTab(['/?wm=2026-10'])

    expect(await screen.findByTestId('workmonth-org-hint')).toHaveTextContent(
      'pages.reports.workday.orgHint'
    )
  })

  it('an empty window (future month) says «no completed days», not «no activity»', async () => {
    mockGetMonth.mockResolvedValue(mockWorkmonthFutureEmpty())
    renderTab(['/?wm=2026-11'])

    expect(await screen.findByText('pages.reports.workmonth.emptyWindow')).toBeInTheDocument()
    expect(screen.queryByTestId('workmonth-window')).not.toBeInTheDocument()
  })

  it('an unusable month in the URL blocks the request', () => {
    renderTab(['/?wm=2026-13'])

    expect(screen.getByRole('alert')).toHaveTextContent('pages.reports.workmonth.invalidMonth')
    expect(mockGetMonth).not.toHaveBeenCalled()
  })
})

describe('WorkmonthTab — error states', () => {
  it('503 WORKDAY_MONTH_NOT_READY lists the stale days and does not retry by itself', async () => {
    mockGetMonth.mockRejectedValue(httpError(ERROR_MOCKS.monthNotReady))
    renderTab(['/?wm=2026-09'])

    const panel = await screen.findByTestId('workday-error')
    expect(panel).toHaveAttribute('data-kind', 'monthNotReady')
    expect(panel).toHaveTextContent('pages.reports.workmonth.notReady.body:5')
    expect(
      within(screen.getByTestId('workmonth-stale-days'))
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['09/08/2026', '09/09/2026', '09/10/2026', '09/21/2026', '09/22/2026'])
    // Give any timer-driven retry a chance to fire: there must be none.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(mockGetMonth).toHaveBeenCalledTimes(1)
  })

  it('404 without a code shows «not available» instead of crashing', async () => {
    mockGetMonth.mockRejectedValue(httpError(ERROR_MOCKS.flagOff))
    renderTab(['/?wm=2026-10'])

    expect(await screen.findByTestId('workday-error')).toHaveAttribute('data-kind', 'notAvailable')
  })

  it('other 503s show the retry hint from params', async () => {
    mockGetMonth.mockRejectedValue(httpError(ERROR_MOCKS.sourceUnavailable))
    renderTab(['/?wm=2026-10'])

    await screen.findByTestId('workday-error')
    expect(screen.getByTestId('workday-retry-after')).toHaveTextContent(
      'pages.reports.workday.retryAfter:60'
    )
  })
})

describe('WorkmonthTab — days modal', () => {
  async function openPetrenko() {
    mockGetMonth.mockResolvedValue(mockWorkmonth())
    mockGetDays.mockResolvedValue(mockWorkmonthDays())
    renderTab(['/?wm=2026-10'])
    await userEvent.click(await screen.findByText('Петренко Андрій Сергійович'))
    return screen.findByTestId('workmonth-days')
  }

  const dayRows = (modal: HTMLElement) => within(modal).getAllByRole('row').slice(1)
  const flagsOf = (row: HTMLElement) =>
    row.querySelector('[data-flags]')?.getAttribute('data-flags') ?? ''

  it('hides the days outside the window by default', async () => {
    const modal = await openPetrenko()

    expect(mockGetDays).toHaveBeenCalledWith(90002, { project_id: 1, month: '2026-10' })
    // 01..05.10 are in the window; 06..31.10 (26 days) are hidden.
    const rows = dayRows(modal)
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.querySelector('td')?.textContent?.slice(0, 10))).toEqual([
      '10/01/2026',
      '10/02/2026',
      '10/03/2026',
      '10/04/2026',
      '10/05/2026',
    ])
  })

  it('flags the holiday, the weekend and the day without activity, as text', async () => {
    const modal = await openPetrenko()
    const rows = dayRows(modal)

    expect(flagsOf(rows[0])).toBe('holiday')
    expect(flagsOf(rows[1])).toBe('')
    expect(flagsOf(rows[2])).toBe('weekend')
    expect(flagsOf(rows[3])).toBe('weekend noActivity')
    expect(
      within(rows[0]).getByText('pages.reports.workmonth.days.flags.holiday')
    ).toBeInTheDocument()
    // Red days (`is_red` per day) carry the ring: 01.10 and 05.10.
    expect(classesOf(rows[0])).toEqual(expect.arrayContaining(RED_TOKENS))
    expect(classesOf(rows[4])).toEqual(expect.arrayContaining(RED_TOKENS))
    expect(classesOf(rows[1])).not.toEqual(expect.arrayContaining(RED_TOKENS))
    // A weekend day with no activity: zeros, not dashes (it is IN the window).
    const cells = Array.from(rows[3].querySelectorAll('td')).map((td) => td.textContent)
    expect(cells.slice(2)).toEqual(['—', '—', '0.0', '0', '0', '0'])
  })

  it('the switch shows the out-of-window days, with «—» for their figures', async () => {
    const modal = await openPetrenko()

    await userEvent.click(within(modal).getByRole('switch'))

    await waitFor(() => expect(dayRows(modal)).toHaveLength(31))
    const sixth = dayRows(modal)[5]
    expect(flagsOf(sixth)).toBe('outOfWindow')
    expect(
      Array.from(sixth.querySelectorAll('td'))
        .map((td) => td.textContent)
        .slice(2)
    ).toEqual(['—', '—', '—', '—', '—', '—'])
  })

  it('shows the same totals as the operator row', async () => {
    const modal = await openPetrenko()

    const stats = Array.from(modal.querySelectorAll('dd')).map((dd) => dd.textContent)
    expect(stats).toEqual(['24.4', '210', '3', '70'])
  })
})
