import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PromisesDailyTable } from '../PromisesDailyTable'
import type { PromisesDailyDepartment } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key
// and i18n.language is 'en', so dates render MM/DD/YYYY and money 1,234.56.

const DATES = ['2026-07-01', '2026-07-02', '2026-07-03']

const DEPARTMENTS: PromisesDailyDepartment[] = [
  { name: 'ТП', values: ['100.00', '0', '50.50'], total: '150.50' },
  { name: 'Стягнення', values: ['200.00', '25.00', '0'], total: '225.00' },
  // The no-department series carries real money and must not be lost.
  { name: null, values: ['0', '5.00', '0'], total: '5.00' },
]

function renderTable(
  props: Partial<Parameters<typeof PromisesDailyTable>[0]> = {}
): ReturnType<typeof render> {
  return render(
    <PromisesDailyTable
      dates={DATES}
      departments={DEPARTMENTS}
      total="380.50"
      emptyMessage="pages.reports.promisesDaily.empty"
      {...props}
    />
  )
}

const bodyRows = () => screen.getAllByRole('rowgroup')[1].querySelectorAll('tr')

describe('PromisesDailyTable', () => {
  it('renders one row per day of the CONTINUOUS axis, in the server order', () => {
    renderTable()

    const rows = bodyRows()
    expect(rows).toHaveLength(DATES.length)
    // A zero-day (07-02 holds only 25 + 5) still gets its row — the axis is
    // the response's own, nothing is filtered out client-side.
    expect(within(rows[0] as HTMLElement).getByText('07/01/2026')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('07/02/2026')).toBeInTheDocument()
    expect(within(rows[2] as HTMLElement).getByText('07/03/2026')).toBeInTheDocument()
  })

  it('heads a column per department plus the day column and «Разом»', () => {
    renderTable()

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual([
      'pages.reports.promisesDaily.columns.date',
      'ТП',
      'Стягнення',
      'pages.reports.promisesDaily.columns.noDepartment',
      'pages.reports.promisesDaily.columns.total',
    ])
  })

  it('labels the null-name series «Без відділу» instead of dropping it', () => {
    renderTable()

    expect(
      screen.getByRole('columnheader', { name: 'pages.reports.promisesDaily.columns.noDepartment' })
    ).toBeInTheDocument()
    // …and its money is on screen (the 5.00 of 07-02).
    expect(within(bodyRows()[1] as HTMLElement).getByText('5.00')).toBeInTheDocument()
  })

  it('labels a whitespace-only department name «Без відділу», not an empty header', () => {
    // The auth-service directory yields whitespace rather than null for an
    // unfilled entry (the same reason orgLabel in outboundCalls trims), so a
    // `?? t(...)` fallback alone would render a blank column head.
    renderTable({
      departments: [{ name: '   ', values: ['100.00', '0', '0'], total: '100.00' }],
    })

    expect(
      screen.getByRole('columnheader', { name: 'pages.reports.promisesDaily.columns.noDepartment' })
    ).toBeInTheDocument()
  })

  it('sums the per-day «Разом» cell client-side across the departments', () => {
    renderTable()

    const rows = bodyRows()
    // 100 + 200 + 0
    expect(within(rows[0] as HTMLElement).getByText('300.00')).toBeInTheDocument()
    // 0 + 25 + 5
    expect(within(rows[1] as HTMLElement).getByText('30.00')).toBeInTheDocument()
    // 50.50 + 0 + 0 — appears twice on the row (the ТП cell and the day
    // total), which is itself the assertion that the sum matched the cell.
    expect(within(rows[2] as HTMLElement).getAllByText('50.50')).toHaveLength(2)
  })

  it('renders the server totals row: per-department sums and the grand total', () => {
    const { container } = renderTable()

    const footer = container.querySelector('tfoot') as HTMLElement
    expect(within(footer).getByText('pages.reports.promisesDaily.totalsRow')).toBeInTheDocument()
    expect(within(footer).getByText('150.50')).toBeInTheDocument()
    expect(within(footer).getByText('225.00')).toBeInTheDocument()
    expect(within(footer).getByText('5.00')).toBeInTheDocument()
    // The grand total is the SERVER's exact-Decimal figure, rendered verbatim
    // — never re-summed client-side.
    expect(within(footer).getByText('380.50')).toBeInTheDocument()
  })

  it('formats money with locale grouping and two decimals', () => {
    renderTable({
      departments: [{ name: 'ТП', values: ['112062.00', '0', '0'], total: '112062.00' }],
      total: '112062.00',
    })

    // Cell, day total and both footer totals — all through the one shared rule.
    expect(screen.getAllByText('112,062.00').length).toBeGreaterThanOrEqual(3)
  })

  it('shows the empty message instead of a bare matrix for an answer with no series', () => {
    const { container } = renderTable({ departments: [], total: '0.00' })

    expect(screen.getByText('pages.reports.promisesDaily.empty')).toBeInTheDocument()
    // No totals row either: there is nothing to total.
    expect(container.querySelector('tfoot')).not.toBeInTheDocument()
  })

  it('shows the empty message for an empty day axis too', () => {
    renderTable({ dates: [] })

    expect(screen.getByText('pages.reports.promisesDaily.empty')).toBeInTheDocument()
  })
})
