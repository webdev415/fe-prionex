/**
 * «Робочий день з розривами» rendered from the PR 6 contract mocks, its error
 * states, and the breaks modal with its personal data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { compile } from '@tailwindcss/node'
import indexCss from '@/index.css?raw'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import { expectNotObscured, expectObscured } from '@/test/piiHelpers'
import { WorkdayTab } from '../WorkdayTab'
import { WORKDAY_RED_ROW_CLASS } from '../WorkdayTable'
import { getWorkdayBreaks, getWorkdayReport } from '../../api/workdayApi'
import {
  ERROR_MOCKS,
  httpError,
  mockWorkday,
  mockWorkdayBreaks,
  mockWorkdayTodayCallsUnavailable,
} from '../../__tests__/contractMocks'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/workdayApi', () => ({
  getWorkdayReport: vi.fn(),
  getWorkdayBreaks: vi.fn(),
  getWorkmonthReport: vi.fn(),
  getWorkmonthDays: vi.fn(),
}))

const authState = {
  user: { active_project_id: 1, projects: [{ id: 1 }], timezone: 'Europe/Kyiv' as string | null },
}
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authState),
}))

// Same functional stub as the sibling report tabs: react-datepicker stays out
// of jsdom, value/onChange behave like the real component.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
    label,
    error,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
    label?: string
    error?: string
  }) => (
    <>
      <input
        data-testid="date-select"
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) =>
          onChange?.({ value: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })
        }
      />
      {error && <span role="alert">{error}</span>}
    </>
  ),
}))

const mockGetReport = vi.mocked(getWorkdayReport)
const mockGetBreaks = vi.mocked(getWorkdayBreaks)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderTab(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <WorkdayTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
const cellsOf = (name: string) =>
  Array.from(rowOf(name).querySelectorAll('td')).map((td) => td.textContent ?? '')
const classesOf = (element: HTMLElement) => element.className.split(/\s+/).filter(Boolean)
const RED_TOKENS = WORKDAY_RED_ROW_CLASS.split(' ')

/** The seeded (fictional) operator names of the contract mocks. */
const FIOS = [
  'Шевчук Дмитро Олегович',
  'Іваненко Олена Петрівна',
  'Петренко Андрій Сергійович',
  'Коваль Марія Іванівна',
]

/** `TAG[attr]` for every attribute anywhere in the document holding one of `needles`. */
function attributeLeaks(needles: string[]): string[] {
  const leaks: string[] = []
  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    for (const attr of Array.from(element.attributes)) {
      if (needles.some((needle) => attr.value.includes(needle))) {
        leaks.push(`${element.tagName}[${attr.name}]`)
      }
    }
  }
  return leaks
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WorkdayTab — rendering the contract mock', () => {
  it('asks for today IN KYIV by default and keeps the URL clean', async () => {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab()
    await screen.findByText('Петренко Андрій Сергійович')

    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      day: getDateStringInTimezone(new Date(), 'Europe/Kyiv'),
      calls: 'day',
      timezone: 'Europe/Kyiv',
    })
    expect(screen.getByTestId('location-search').textContent).toBe('')
  })

  it('renders one row per operator with Kyiv clock times, hours, minutes and calls', async () => {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])
    await screen.findByText('Петренко Андрій Сергійович')

    // 05:58:03Z → 08:58 Kyiv; 29004 s → 8.1 h; 4 breaks; 6124 s → 102 min;
    // 3854 s → 64 min; calls 18 / 00:24:22 / 9 / 00:19:30 / 00:01:21.
    expect(cellsOf('Петренко Андрій Сергійович')).toEqual([
      expect.stringContaining('Петренко Андрій Сергійович'),
      'Стягнення',
      'Стягнення-2',
      '08:58',
      '18:01',
      '8.1',
      '4',
      '102',
      '64',
      '18',
      '00:24:22',
      '9',
      '00:19:30',
      '00:01:21',
    ])
  })

  it('marks ONLY the red row (`is_red` from the answer) with the ring and a text', async () => {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])
    await screen.findByText('Петренко Андрій Сергійович')

    expect(classesOf(rowOf('Петренко Андрій Сергійович'))).toEqual(
      expect.arrayContaining(RED_TOKENS)
    )
    for (const name of [
      'Шевчук Дмитро Олегович',
      'Іваненко Олена Петрівна',
      'Коваль Марія Іванівна',
    ]) {
      expect(classesOf(rowOf(name))).not.toEqual(expect.arrayContaining(RED_TOKENS))
    }
    expect(document.querySelectorAll('[data-red="true"]')).toHaveLength(1)
    expect(
      within(rowOf('Петренко Андрій Сергійович')).getByText('pages.reports.workday.redRowLabel')
    ).toBeInTheDocument()
  })

  it('follows `is_red`, not a threshold recomputed on the frontend', async () => {
    // 90003 has NO breaks; the server says red anyway — the row follows it.
    const answer = mockWorkday()
    answer.rows[3].is_red = true
    answer.rows[2].is_red = false
    mockGetReport.mockResolvedValue(answer)
    renderTab(['/?wd=2026-09-17'])
    await screen.findByText('Коваль Марія Іванівна')

    expect(classesOf(rowOf('Коваль Марія Іванівна'))).toEqual(expect.arrayContaining(RED_TOKENS))
    expect(classesOf(rowOf('Петренко Андрій Сергійович'))).not.toEqual(
      expect.arrayContaining(RED_TOKENS)
    )
  })

  it('says that department and group are the current ones (contract decision 5)', async () => {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])

    expect(await screen.findByTestId('workday-org-hint')).toHaveTextContent(
      'pages.reports.workday.orgHint'
    )
  })

  it('takes the legend threshold from meta', async () => {
    const answer = mockWorkday()
    answer.meta.red_threshold_seconds = 3600
    mockGetReport.mockResolvedValue(answer)
    renderTab(['/?wd=2026-09-17'])

    expect(await screen.findByTestId('workday-legend')).toHaveTextContent(
      'pages.reports.workday.legend:60'
    )
  })

  it('shows zeros for an operator without calls and «—» for the average', async () => {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])
    await screen.findByText('Шевчук Дмитро Олегович')

    const cells = cellsOf('Шевчук Дмитро Олегович')
    // No group → «—»; calls 0 / 00:00:00 / 0 / 00:00:00 / — (null average).
    expect(cells[2]).toBe('—')
    expect(cells.slice(9)).toEqual(['0', '00:00:00', '0', '00:00:00', '—'])
  })

  it('shows a zero-break day as zeros, not as missing', async () => {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])
    await screen.findByText('Коваль Марія Іванівна')

    expect(cellsOf('Коваль Марія Іванівна').slice(6, 9)).toEqual(['0', '0', '0'])
  })

  it('today, calls unavailable: a notice, «—» in every call cell, «на зараз» on working time', async () => {
    mockGetReport.mockResolvedValue(mockWorkdayTodayCallsUnavailable())
    renderTab(['/?wd=2026-10-06&wdc=cumulative'])
    await screen.findByText('Коваль Марія Іванівна')

    expect(screen.getByTestId('workday-notice-calls-unavailable')).toHaveTextContent(
      'pages.reports.workday.callsUnavailable'
    )
    expect(screen.getByTestId('workday-notice-running')).toBeInTheDocument()
    // The cumulative hint is about call columns that are not there.
    expect(screen.queryByTestId('workday-notice-cumulative')).not.toBeInTheDocument()
    for (const name of ['Іваненко Олена Петрівна', 'Коваль Марія Іванівна']) {
      const cells = cellsOf(name)
      expect(cells.slice(9)).toEqual(['—', '—', '—', '—', '—'])
      expect(cells[5]).toContain('pages.reports.workday.soFar')
    }
  })

  it('a closed day has no «на зараз» and no running notice', async () => {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])
    await screen.findByText('Коваль Марія Іванівна')

    expect(screen.queryByText('pages.reports.workday.soFar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('workday-notice-running')).not.toBeInTheDocument()
  })

  it('switching the calls window writes `wdc` and refetches with it', async () => {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])
    await screen.findByText('Коваль Марія Іванівна')

    await userEvent.click(
      screen.getByRole('tab', { name: 'pages.reports.workday.calls.cumulative' })
    )

    await waitFor(() =>
      expect(mockGetReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ day: '2026-09-17', calls: 'cumulative' })
      )
    )
    expect(screen.getByTestId('location-search').textContent).toContain('wdc=cumulative')
  })

  it('an unusable day in the URL blocks the request and flags the field', () => {
    renderTab(['/?wd=2026-02-30'])

    expect(screen.getByRole('alert')).toHaveTextContent('pages.reports.workday.invalidDay')
    expect(mockGetReport).not.toHaveBeenCalled()
  })
})

describe('WorkdayTab — error states', () => {
  it('404 without a code (flag off / backend not deployed): «not available», no crash, no retry', async () => {
    mockGetReport.mockRejectedValue(httpError(ERROR_MOCKS.flagOff))
    renderTab(['/?wd=2026-09-17'])

    const panel = await screen.findByTestId('workday-error')
    expect(panel).toHaveAttribute('data-kind', 'notAvailable')
    expect(panel).toHaveTextContent('pages.reports.workday.notAvailable.title')
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('503 busy: the retry hint with the seconds from params, one request, a manual retry', async () => {
    mockGetReport.mockRejectedValue(httpError(ERROR_MOCKS.liveBusy, { withHeaders: false }))
    renderTab(['/?wd=2026-10-06'])

    const panel = await screen.findByTestId('workday-error')
    expect(panel).toHaveAttribute('data-kind', 'retryLater')
    expect(screen.getByTestId('workday-retry-after')).toHaveTextContent(
      'pages.reports.workday.retryAfter:20'
    )
    expect(mockGetReport).toHaveBeenCalledTimes(1)

    await userEvent.click(
      within(panel).getByRole('button', { name: 'pages.reports.workday.error.retry' })
    )
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(2))
  })

  it('a coded 400 shows the server sentence (through codes.<CODE>), not the generic title', async () => {
    mockGetReport.mockRejectedValue(httpError(ERROR_MOCKS.dayInFuture))
    renderTab(['/?wd=2026-10-07'])

    const panel = await screen.findByTestId('workday-error')
    expect(panel).toHaveAttribute('data-kind', 'other')
    // The test i18n has no `codes.*`, so translateErrorCode falls back to the
    // detail — in the app the uk/en/es `codes.WORKDAY_DAY_IN_FUTURE` applies.
    expect(panel).toHaveTextContent('day must not be after today')
  })

  it('403 shows «no permission» without a retry button', async () => {
    mockGetReport.mockRejectedValue(
      httpError({ status: 403, headers: {}, body: { detail: 'Forbidden' } })
    )
    renderTab(['/?wd=2026-09-17'])

    const panel = await screen.findByTestId('workday-error')
    expect(panel).toHaveTextContent('pages.reports.workday.forbidden')
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('WorkdayTab — breaks modal', () => {
  async function openPetrenko() {
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])
    await userEvent.click(await screen.findByText('Петренко Андрій Сергійович'))
    return screen.findByTestId('workday-breaks')
  }

  it('opens on a row click and lists the breaks with Kyiv times, minutes and both events', async () => {
    mockGetBreaks.mockResolvedValue(mockWorkdayBreaks())
    const modal = await openPetrenko()

    expect(mockGetBreaks).toHaveBeenCalledTimes(1)
    expect(mockGetBreaks).toHaveBeenCalledWith(90002, {
      project_id: 1,
      day: '2026-09-17',
      timezone: 'Europe/Kyiv',
    })
    const rows = within(modal).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(4)
    // 07:41:15Z → 10:41 Kyiv; 828 s → 14 min.
    const first = Array.from(rows[0].querySelectorAll('td')).map((td) => td.textContent)
    expect(first.slice(0, 3)).toEqual(['10:41', '10:55', '14'])
    expect(first[3]).toContain('outbound → 380000000011: answered')
    expect(first[4]).toContain('Дзвінок боржнику - Контакт - Обіцянка оплати')
  })

  it('PII: every call label (phone number) is inside data-openreplay-obscured and in no attribute', async () => {
    mockGetBreaks.mockResolvedValue(mockWorkdayBreaks())
    const modal = await openPetrenko()

    const phoneLabels = within(modal).getAllByText(/380000000\d{3}/)
    expect(phoneLabels).toHaveLength(4)
    for (const label of phoneLabels) expectObscured(label)
    // The times and durations stay readable in a replay.
    expectNotObscured(within(modal).getAllByText('10:41')[0])

    const leaks: string[] = []
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      for (const attr of Array.from(element.attributes)) {
        if (/380000000\d{3}/.test(attr.value)) leaks.push(`${element.tagName}[${attr.name}]`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('PII: the operator names appear only inside data-openreplay-obscured and in no attribute', async () => {
    mockGetBreaks.mockResolvedValue(mockWorkdayBreaks())
    const modal = await openPetrenko()

    // The table (all four seeded names) and the modal heading.
    for (const name of FIOS) {
      const nodes = screen.getAllByText(name)
      expect(nodes.length).toBeGreaterThan(0)
      for (const node of nodes) expectObscured(node)
    }
    expect(within(document.body).getAllByText('Петренко Андрій Сергійович')).toHaveLength(2)
    expect(modal).toBeInTheDocument()
    // Column headers stay readable.
    expectNotObscured(screen.getByText('pages.reports.workday.columns.operator'))
    expect(attributeLeaks(FIOS)).toEqual([])
    // The name is still a real button (keyboard-reachable), named by its
    // text and carrying no aria-label/title. (`getByRole` cannot see it while
    // the modal hides the page behind it from assistive technology.)
    const button = screen.getByText('Коваль Марія Іванівна').closest('button')
    expect(button).not.toBeNull()
    expect(button!.getAttribute('aria-label')).toBeNull()
    expect(button!.getAttribute('title')).toBeNull()
  })

  it('a zero-break day says so with the threshold from meta', async () => {
    const answer = mockWorkdayBreaks()
    answer.breaks = []
    answer.breaks_count = 0
    mockGetBreaks.mockResolvedValue(answer)
    const modal = await openPetrenko()

    expect(modal).toHaveTextContent('pages.reports.workday.breaks.noBreaks')
  })

  it('404 operator not found shows its own message', async () => {
    mockGetBreaks.mockRejectedValue(httpError(ERROR_MOCKS.operatorNotFound))
    mockGetReport.mockResolvedValue(mockWorkday())
    renderTab(['/?wd=2026-09-17'])
    await userEvent.click(await screen.findByText('Петренко Андрій Сергійович'))

    const panel = await screen.findByTestId('workday-error')
    expect(panel).toHaveAttribute('data-kind', 'operatorNotFound')
  })
})

/**
 * The rules `src/index.css` compiles the red ring to (same helper as the
 * operator-promises highlight test): jsdom applies no CSS, so a class list
 * proves nothing about what the eye gets.
 */
async function compileUtilities(candidates: string[]): Promise<string> {
  const self = import.meta.url.replace(/^file:\/\//, '')
  const base = self.slice(0, self.lastIndexOf('/src/') + '/src'.length)
  const compiler = await compile(indexCss, { base, onDependency: () => {} })
  return compiler.build(candidates)
}

function ruleBodiesOf(css: string, utility: string): string[] {
  const selector = utility.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  return Array.from(css.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'g')), (m) => m[1])
}

describe('the red-row mark on the compiled stylesheet', () => {
  it('is a real utility that sets no background (DataTable zebra would win it)', async () => {
    const css = await compileUtilities(RED_TOKENS)
    for (const token of RED_TOKENS) {
      const bodies = ruleBodiesOf(css, token)
      expect(bodies, `${token}: no rule compiled`).not.toEqual([])
      for (const body of bodies)
        expect(body, `${token} sets a background`).not.toMatch(/background/)
    }
    // The colour is the error token, defined in every theme.
    expect(ruleBodiesOf(css, 'ring-error-500').join('')).toContain('--color-error-500')
  })
})
