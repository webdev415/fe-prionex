import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LOW_VERIFICATION_COLUMN_COUNT, LowVerificationTable } from '../LowVerificationTable'
import type { LowVerificationFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key,
// and i18n.language is 'en' (→ en-US number/date formatting).

function makeRow(overrides: Partial<LowVerificationFeedRow> = {}): LowVerificationFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    employee_id: 6959,
    full_name: 'Коваленко Іван Петрович',
    department: 'Дайлер',
    group_name: 'Полка',
    sell_date: '2026-07-29',
    assignment_date: '2026-07-30',
    last_interaction_date: '2026-08-01',
    body_amount: '15000.00',
    verified_count: 0,
    ...overrides,
  }
}

function renderTable(rows: LowVerificationFeedRow[], emptyMessage = 'empty') {
  return render(
    <MemoryRouter>
      <LowVerificationTable rows={rows} emptyMessage={emptyMessage} />
    </MemoryRouter>
  )
}

describe('LowVerificationTable', () => {
  it('renders a row per client with all nine columns', () => {
    renderTable([makeRow(), makeRow({ client_id: 84214, inn: '0987654321' })])

    expect(screen.getByText('pages.reports.lowVerification.columns.inn')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.lowVerification.columns.sellDate')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.lowVerification.columns.assignmentDate')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.reports.lowVerification.columns.employee')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.lowVerification.columns.department')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.lowVerification.columns.group')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.lowVerification.columns.lastInteraction')
    ).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.lowVerification.columns.verifiedCount')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.reports.lowVerification.columns.bodyAmount')).toBeInTheDocument()

    expect(screen.getAllByText('Коваленко Іван Петрович')).toHaveLength(2)
    expect(screen.getAllByText('Дайлер')).toHaveLength(2)
    expect(screen.getAllByText('Полка')).toHaveLength(2)
  })

  it('renders exactly as many headers as the exported column count promises', () => {
    // The skeleton of this table is sized from LOW_VERIFICATION_COLUMN_COUNT
    // while the columns themselves are built inside the component (they need
    // `t`), so this is what catches the two drifting apart.
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader')).toHaveLength(LOW_VERIFICATION_COLUMN_COUNT)
  })

  it('links each row to the client details route built from client_id', () => {
    // The API deliberately ships no link field — a hardcoded production host
    // would be wrong on every other environment (docs/low-verification-feed.md).
    renderTable([makeRow()])

    expect(screen.getByRole('link', { name: '1234567890' })).toHaveAttribute(
      'href',
      '/dashboard/clients/84213'
    )
  })

  it('keeps the client link reachable when the tax id is missing', () => {
    renderTable([makeRow({ inn: null })])

    // Visible text degrades to "—", but the link must not be named "—".
    const link = screen.getByRole('link', { name: 'pages.reports.lowVerification.openClient' })
    expect(link).toHaveAttribute('href', '/dashboard/clients/84213')
    expect(link).toHaveTextContent('—')
  })

  it('formats the dates as calendar days in the UI locale', () => {
    renderTable([makeRow()])

    expect(screen.getByText('07/29/2026')).toBeInTheDocument()
    expect(screen.getByText('07/30/2026')).toBeInTheDocument()
    expect(screen.getByText('08/01/2026')).toBeInTheDocument()
  })

  it('renders "—" for every nullable column', () => {
    renderTable([
      makeRow({
        inn: null,
        group_name: null,
        assignment_date: null,
        last_interaction_date: null,
      }),
    ])

    // inn, group_name, assignment_date, last_interaction_date
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('formats body_amount arriving as a Decimal JSON string', () => {
    renderTable([makeRow({ body_amount: '15000.00' })])

    expect(screen.getByText('15,000.00')).toBeInTheDocument()
  })

  it('degrades a malformed body_amount to "—" instead of NaN', () => {
    renderTable([makeRow({ body_amount: 'not-a-number' })])

    expect(screen.queryByText('NaN')).not.toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the supplied empty message when the feed has no rows', () => {
    renderTable([], 'pages.reports.lowVerification.empty')

    expect(screen.getByText('pages.reports.lowVerification.empty')).toBeInTheDocument()
  })

  it('offers no client-side sorting (the order is fixed server-side)', () => {
    renderTable([makeRow()])

    // Card 148 parity: verified_count asc, employee name, client_id — sorting
    // one page of a server-paginated feed would reorder 50 rows out of
    // thousands, so no header is sortable.
    expect(document.querySelectorAll('th.cursor-pointer')).toHaveLength(0)
  })
})
