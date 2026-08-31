import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { COMMUNICATION_GAP_COLUMN_COUNT, CommunicationGapTable } from '../CommunicationGapTable'
import type { CommunicationGapFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key
// and i18n.language is 'en'. formatCalendarDay (@/lib/calendarDay) and
// formatNumber (@/lib/localeFormat) are real, so the day/number rendering below
// exercises the actual Intl path, not a stub.

function makeRow(overrides: Partial<CommunicationGapFeedRow> = {}): CommunicationGapFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    sell_date: '2026-07-04',
    assignment_date: '2026-07-10',
    last_promise_date: null,
    employee_id: 6959,
    employee_name: 'Коваленко Іван Петрович',
    department: 'ТП',
    group_name: 'Група №1',
    body_amount: '15000.00',
    last_interaction_date: '2026-08-02',
    communication_gap: 15,
    ...overrides,
  }
}

function renderTable(rows: CommunicationGapFeedRow[], emptyMessage = 'empty') {
  return render(
    <MemoryRouter>
      <CommunicationGapTable rows={rows} emptyMessage={emptyMessage} />
    </MemoryRouter>
  )
}

describe('CommunicationGapTable', () => {
  it('renders a row per client with all ten columns', () => {
    renderTable([makeRow(), makeRow({ client_id: 84214, inn: '0987654321' })])

    expect(screen.getByText('pages.reports.communicationGap.columns.inn')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.communicationGap.columns.sellDate')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.communicationGap.columns.assignmentDate')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.reports.communicationGap.columns.employee')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.communicationGap.columns.department')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.reports.communicationGap.columns.group')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.communicationGap.columns.lastInteraction')
    ).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.communicationGap.columns.lastPromise')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.reports.communicationGap.columns.gap')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.communicationGap.columns.bodyAmount')
    ).toBeInTheDocument()

    expect(screen.getAllByText('Коваленко Іван Петрович')).toHaveLength(2)
    expect(screen.getAllByText('ТП')).toHaveLength(2)
    expect(screen.getAllByText('Група №1')).toHaveLength(2)
  })

  it('renders exactly as many headers as the exported column count promises', () => {
    // The skeleton of this table is sized from COMMUNICATION_GAP_COLUMN_COUNT
    // while the columns themselves are built inside the component (they need
    // `t`), so this is what catches the two drifting apart.
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader')).toHaveLength(COMMUNICATION_GAP_COLUMN_COUNT)
  })

  it('renders every date column as its own calendar day, unshifted', () => {
    // All four are backend DATEs cut in three different zones server-side
    // (requested timezone / UTC / none). The UI must show the day verbatim —
    // parsed as UTC midnight they would render as the previous day west of
    // Greenwich.
    renderTable([makeRow({ last_promise_date: '2026-08-01' })])

    expect(screen.getByText('07/04/2026')).toBeInTheDocument() // sell_date
    expect(screen.getByText('07/10/2026')).toBeInTheDocument() // assignment_date
    expect(screen.getByText('08/02/2026')).toBeInTheDocument() // last_interaction_date
    expect(screen.getByText('08/01/2026')).toBeInTheDocument() // last_promise_date
  })

  it('renders the days of silence as a plain number', () => {
    // The star column — but rendered without emphasis: no threshold exists to
    // colour it against, and the server-side sort already puts each employee's
    // worst gaps first.
    renderTable([makeRow({ communication_gap: 49 })])

    expect(screen.getByText('49')).toBeInTheDocument()
  })

  it('renders "—" for a null gap instead of "NaN"', () => {
    // Null only when BOTH inputs are missing (no assignment history AND no
    // interaction) — no production row shows it, but the schema allows it and
    // an undefined-safe guard is what keeps the whole tab alive.
    renderTable([makeRow({ communication_gap: null })])

    expect(screen.getAllByText('—')).toHaveLength(2) // the gap + the null promise
  })

  it('renders the Decimal-as-string debt amount with two decimals', () => {
    // body_amount arrives as a JSON STRING ("15000.00") because money is an
    // exact Decimal server-side.
    renderTable([makeRow()])

    expect(screen.getByText('15,000.00')).toBeInTheDocument()
  })

  it('renders "—" for an unparseable debt amount instead of "NaN"', () => {
    renderTable([makeRow({ body_amount: 'not-a-number' })])

    // The amount + the null promise date.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders "—" for the promise date of a row nobody extracted a promise from', () => {
    // 89–94 % of production rows: the column is intentionally sparse, not
    // broken — a client with a FUTURE promise is not in this feed at all.
    renderTable([makeRow()])

    expect(screen.getAllByText('—')).toHaveLength(1)
  })

  it('renders "—" for every nullable column', () => {
    renderTable([
      makeRow({
        inn: null,
        sell_date: null,
        assignment_date: null,
        last_promise_date: null,
        employee_name: null,
        department: null,
        group_name: null,
        last_interaction_date: null,
        communication_gap: null,
      }),
    ])

    // inn, sell, assignment, employee, department, group, last interaction,
    // last promise, gap — nine of the ten columns; body_amount is
    // structurally non-NULL.
    expect(screen.getAllByText('—')).toHaveLength(9)
  })

  it('keeps a department-less client in the list rather than hiding it', () => {
    // Card 125's population filter is `department in (…) OR department IS
    // NULL` — unique to this card — so an employee outside the org tree keeps
    // their clients here (the sibling Card 148 feed drops them).
    renderTable([makeRow({ department: null, group_name: null })])

    expect(screen.getByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(3) // department, group, promise
  })

  it('links each row to the client details route built from client_id', () => {
    // The API deliberately ships no link field — a hardcoded production host
    // would be wrong on every other environment (docs/communication-gap-feed.md).
    renderTable([makeRow()])

    expect(screen.getByRole('link', { name: '1234567890' })).toHaveAttribute(
      'href',
      '/dashboard/clients/84213'
    )
  })

  it('keeps the client link reachable when the tax id is missing', () => {
    renderTable([makeRow({ inn: null })])

    // Visible text degrades to "—", but the link must not be named "—".
    const link = screen.getByRole('link', { name: 'pages.reports.communicationGap.openClient' })
    expect(link).toHaveAttribute('href', '/dashboard/clients/84213')
    expect(link).toHaveTextContent('—')
  })

  it('shows the supplied empty message when the feed has no rows', () => {
    renderTable([], 'pages.reports.communicationGap.empty')

    expect(screen.getByText('pages.reports.communicationGap.empty')).toBeInTheDocument()
  })

  it('offers no client-side sorting (the order is fixed server-side)', () => {
    renderTable([makeRow()])

    // Card 125 parity: employee name → gap DESC → client_id — sorting one page
    // of a server-paginated feed would reorder 50 rows out of tens of
    // thousands, so no header is sortable.
    expect(document.querySelectorAll('th.cursor-pointer')).toHaveLength(0)
  })
})
