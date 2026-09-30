import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { compile } from '@tailwindcss/node'
import indexCss from '@/index.css?raw'
import enCommon from '@/../public/locales/en/common.json'
import esCommon from '@/../public/locales/es/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import { OperatorPromisesTab } from '../OperatorPromisesTab'
import { OPERATOR_PROMISES_HIGHLIGHT_CLASS } from '../OperatorPromisesTable'
import { getOperatorPromisesReport } from '../../api/operatorPromisesApi'
import { linkedOperatorNotice } from '../../utils/linkedOperatorNotice'
import type { OperatorPromisesReportResponse, OperatorPromisesRow } from '../../types'

/**
 * The `?opu=` reader — the operator a sibling tab (recorded payments, card
 * 76) linked to by `user_id`. Kept in a file of its own so the tab's
 * existing suite stays untouched: this is an ADDITION to the tab, and the
 * tests for it are additions too.
 */

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/operatorPromisesApi', () => ({
  getOperatorPromisesReport: vi.fn(),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { active_project_id: 1, projects: [{ id: 1 }], timezone: null } }),
}))

vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({ value, label }: { value?: string | Date | null; label?: string }) => (
    <input
      data-testid="date-select"
      aria-label={label}
      value={typeof value === 'string' ? value : ''}
      readOnly
    />
  ),
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

function makeResponse(rows: OperatorPromisesRow[]): OperatorPromisesReportResponse {
  return {
    project_id: 1,
    date_from: '2026-08-01',
    date_to: '2026-08-31',
    timezone: 'UTC',
    rows,
    totals: {
      operators: rows.length,
      interactions_count: 0,
      sum_from: '0',
      sum_to: '0',
      paid_full: '0',
      paid_verified: '0',
      unpaid: '0',
      conversion: null,
      verified_unpaid: '0',
      verified_conversion: null,
    },
    generated_at: '2026-09-29T10:15:31Z',
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderTab(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <OperatorPromisesTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const search = () => screen.getByTestId('location-search').textContent ?? ''
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
const classesOf = (element: HTMLElement) => element.className.split(/\s+/).filter(Boolean)
const notice = () => screen.getByTestId('operator-promises-linked-operator')

/** The tokens the linked row is marked with — what every assertion below is about. */
const HIGHLIGHT_TOKENS = OPERATOR_PROMISES_HIGHLIGHT_CLASS.split(' ')

// Both rows are «Стягнення» (`collection`): the fixed «ТП» sub-tab hides them.
const TWO_ROWS = [makeRow(), makeRow({ user_id: 202, fio: 'Коваленко Іван Петрович' })]

/**
 * The rules `src/index.css` compiles the given utilities to, by the same
 * compiler the build runs (`@tailwindcss/node` arrives with
 * `@tailwindcss/postcss`, version-locked to it). ~0.5 s; jsdom applies no
 * CSS, so this is the only way a test can see what the eye gets.
 */
async function compileUtilities(candidates: string[]): Promise<string> {
  // The `src` directory, from this file's own URL (a `file://` path under
  // vitest). Not `new URL('…', import.meta.url)` — Vite rewrites that form
  // into an asset URL — and no `node:` import, which `tsconfig.app.json`
  // (types pinned to `vite/client`) does not type.
  const self = import.meta.url.replace(/^file:\/\//, '')
  const base = self.slice(0, self.lastIndexOf('/src/') + '/src'.length)
  const compiler = await compile(indexCss, { base, onDependency: () => {} })
  return compiler.build(candidates)
}

/** Every rule body the stylesheet emits for `.<utility>` (fallback blocks included). */
function ruleBodiesOf(css: string, utility: string): string[] {
  const selector = utility.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  return Array.from(css.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'g')), (m) => m[1])
}

let scrollIntoView: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView =
    scrollIntoView as unknown as typeof Element.prototype.scrollIntoView
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OperatorPromisesTab — the linked operator (?opu=)', () => {
  it('highlights and scrolls to the linked operator’s row, with the same window', async () => {
    mockGetReport.mockResolvedValue(makeResponse(TWO_ROWS))

    renderTab(['/?opf=2026-08-01&opt=2026-08-31&opu=202'])
    await screen.findByText('Коваленко Іван Петрович')

    // The window the link carried is what was requested…
    expect(mockGetReport).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-08-01', date_to: '2026-08-31' })
    )
    // …the row is marked for the eye AND for assistive technology…
    const name = screen.getByText('Коваленко Іван Петрович').closest('[data-highlighted]')
    expect(name).not.toBeNull()
    expect(name).toHaveAttribute('aria-current', 'true')
    expect(classesOf(rowOf('Коваленко Іван Петрович'))).toEqual(
      expect.arrayContaining(HIGHLIGHT_TOKENS)
    )
    expect(classesOf(rowOf('Баженов Олексій Володимирович'))).not.toEqual(
      expect.arrayContaining(HIGHLIGHT_TOKENS)
    )
    // …with a RING, never a background: DataTable paints its own zebra
    // `bg-muted`/`bg-card` on every row, and a second `bg-*` appended after
    // it does not win — Tailwind v4 orders the stylesheet by its own source
    // order, not by the order of the tokens in `class`, and `.bg-muted`
    // comes after `.bg-information-50`. So the highlight was invisible on
    // every even row, the first one included. (The compiled check is the
    // next test.)
    expect(HIGHLIGHT_TOKENS.filter((token) => !token.startsWith('ring-'))).toEqual([])
    // …and the ring is INSET: DataTable's `<table>` collapses its borders, and
    // an outset box-shadow on a `<tr>` is painted over by the neighbouring
    // rows, so only the right edge of the ring survives. Inset draws all four
    // sides inside the row's own box (checked by rendering in Chromium).
    expect(HIGHLIGHT_TOKENS).toContain('ring-inset')
    // …scrolled into view once the rows are on screen…
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    // …and the notice names them. The link is never a FILTER: both rows stay.
    expect(notice()).toHaveAttribute('data-notice', 'highlightedOperator')
    expect(notice()).toHaveTextContent('pages.reports.operatorPromises.highlightedOperator')
    expect(screen.getByText('Баженов Олексій Володимирович')).toBeInTheDocument()
    expect(screen.getByText('Коваленко Іван Петрович')).toBeInTheDocument()
  })

  it('marks the row with utilities that set NO background — checked on the compiled stylesheet', async () => {
    // `className` in jsdom proves nothing about what the eye gets; the
    // stylesheet does. Each highlight token must be a utility this
    // stylesheet knows, and none of them may set the one property DataTable's
    // zebra classes set — that is the property a `bg-*` mark would have to
    // win, and loses by stylesheet order.
    const css = await compileUtilities([...HIGHLIGHT_TOKENS, 'bg-muted', 'bg-card'])
    for (const token of HIGHLIGHT_TOKENS) {
      const bodies = ruleBodiesOf(css, token)
      expect(bodies, `${token}: no rule compiled — not a utility src/index.css knows`).not.toEqual(
        []
      )
      for (const body of bodies)
        expect(body, `${token} sets a background`).not.toMatch(/background/)
    }
    // The zebra classes DO set it — the very property the ring stays out of.
    expect(ruleBodiesOf(css, 'bg-muted').join('')).toContain('background-color')
    expect(ruleBodiesOf(css, 'bg-card').join('')).toContain('background-color')
  })

  it('highlights nothing and shows no notice without the key', async () => {
    mockGetReport.mockResolvedValue(makeResponse(TWO_ROWS))

    renderTab(['/?opf=2026-08-01&opt=2026-08-31'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(document.querySelector('[data-highlighted]')).toBeNull()
    expect(screen.queryByTestId('operator-promises-linked-operator')).not.toBeInTheDocument()
    for (const row of screen.getAllByRole('row')) {
      expect(classesOf(row)).not.toEqual(expect.arrayContaining(HIGHLIGHT_TOKENS))
    }
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('says so when the linked operator has no row in the period', async () => {
    // A link from a payments window into a period where the operator took no
    // promises — a silent unmarked table would read as "the link did nothing".
    mockGetReport.mockResolvedValue(makeResponse(TWO_ROWS))

    renderTab(['/?opf=2026-08-01&opt=2026-08-31&opu=777'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(notice()).toHaveAttribute('data-notice', 'highlightedOperatorMissing')
    expect(notice()).toHaveTextContent('pages.reports.operatorPromises.highlightedOperatorMissing')
    expect(document.querySelector('[data-highlighted]')).toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('says the operator IS in the report when only the sub-tab hides them — never "no rows"', async () => {
    // Arrived on «Всі» (the link drops `opd`), then clicked «ТП» — or a
    // hand-edited `opd`. The row exists; the period is not empty for them.
    // "No rows in this period" here would be false, and the name is known.
    mockGetReport.mockResolvedValue(makeResponse(TWO_ROWS))

    renderTab(['/?opf=2026-08-01&opt=2026-08-31&opu=202&opd=tp'])
    await screen.findByText('pages.reports.operatorPromises.emptyDepartment')

    expect(notice()).toHaveAttribute('data-notice', 'highlightedOperatorHidden')
    expect(notice()).toHaveTextContent('pages.reports.operatorPromises.highlightedOperatorHidden')
    expect(notice()).not.toHaveTextContent('highlightedOperatorMissing')
    // Nothing to mark or scroll to: the row is not on screen.
    expect(document.querySelector('[data-highlighted]')).toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()

    // Back on «Всі» the same link highlights the row and the notice follows.
    await userEvent.click(
      screen.getByRole('tab', { name: 'pages.reports.operatorPromises.subtabs.all' })
    )
    await screen.findByText('Коваленко Іван Петрович')
    expect(notice()).toHaveAttribute('data-notice', 'highlightedOperator')
    expect(document.querySelector('[data-highlighted]')).not.toBeNull()
  })

  it('drops only the key when the highlight is cleared — the window stays', async () => {
    mockGetReport.mockResolvedValue(makeResponse(TWO_ROWS))

    renderTab(['/?opf=2026-08-01&opt=2026-08-31&opu=202'])
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.operatorPromises.clearHighlight' })
    )

    await waitFor(() => expect(search()).not.toContain('opu='))
    expect(search()).toContain('opf=2026-08-01')
    expect(search()).toContain('opt=2026-08-31')
    expect(screen.queryByTestId('operator-promises-linked-operator')).not.toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it.each(['abc', '0', '-5', '1.5'])('ignores a malformed ?opu=%s as "no link"', async (raw) => {
    // Nothing on this tab writes the key, so a malformed one is a hand-edited
    // URL with nothing to act on — not a complaint.
    mockGetReport.mockResolvedValue(makeResponse(TWO_ROWS))

    renderTab([`/?opf=2026-08-01&opt=2026-08-31&opu=${raw}`])
    await screen.findByText('Коваленко Іван Петрович')

    expect(screen.queryByTestId('operator-promises-linked-operator')).not.toBeInTheDocument()
    expect(document.querySelector('[data-highlighted]')).toBeNull()
  })

  it('carries the four notice keys in every locale, with the placeholders the tab fills', () => {
    for (const dictionary of [ukCommon, enCommon, esCommon]) {
      const section = dictionary.pages.reports.operatorPromises as Record<string, unknown>
      expect(typeof section.highlightedOperator).toBe('string')
      expect(typeof section.highlightedOperatorHidden).toBe('string')
      expect(typeof section.highlightedOperatorMissing).toBe('string')
      expect(typeof section.clearHighlight).toBe('string')
      expect(section.highlightedOperator).toContain('{{name}}')
      expect(section.highlightedOperatorHidden).toContain('{{name}}')
      expect(section.highlightedOperatorMissing).toContain('{{id}}')
    }
  })
})

describe('linkedOperatorNotice — which sentence, and what goes into it', () => {
  // The component test sees only keys (react-i18next is mocked); this is
  // where the interpolation — the NAME for a known row, the bare id only
  // for an absent one — is pinned.
  const row = makeRow({ user_id: 202, fio: 'Коваленко Іван Петрович' })

  it('names the operator when their row is on screen', () => {
    expect(linkedOperatorNotice(202, row, true)).toEqual({
      key: 'highlightedOperator',
      params: { name: 'Коваленко Іван Петрович' },
    })
  })

  it('names the operator when their row exists but the sub-tab hides it — not "missing"', () => {
    expect(linkedOperatorNotice(202, row, false)).toEqual({
      key: 'highlightedOperatorHidden',
      params: { name: 'Коваленко Іван Петрович' },
    })
  })

  it('falls back to the id, as "missing", only when the period has no row at all', () => {
    expect(linkedOperatorNotice(777, null, false)).toEqual({
      key: 'highlightedOperatorMissing',
      params: { id: 777 },
    })
  })

  it('stands the id in for a null fio — the row exists, the directory just has no name', () => {
    const nameless = makeRow({ user_id: 202, fio: null })
    expect(linkedOperatorNotice(202, nameless, false)).toEqual({
      key: 'highlightedOperatorHidden',
      params: { name: '202' },
    })
  })
})
