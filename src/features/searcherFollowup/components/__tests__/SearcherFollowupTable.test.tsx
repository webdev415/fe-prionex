import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SEARCHER_FOLLOWUP_COLUMN_COUNT, SearcherFollowupTable } from '../SearcherFollowupTable'
import type { SearcherFollowupRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
// formatDateTime (@/lib/formatters) is real, so the timezone rendering below
// exercises the actual Intl path, not a stub.

function makeRow(overrides: Partial<SearcherFollowupRow> = {}): SearcherFollowupRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    interaction_at: '2026-08-12T06:14:03Z',
    searcher_id: 7021,
    searcher_name: 'Мельник Ольга Ігорівна',
    employee_id: 6959,
    employee_name: 'Коваленко Іван Петрович',
    department: 'Дайлер',
    group_name: 'Полка',
    last_call_at: '2026-08-11T15:02:44Z',
    last_call_outcome: 'no_answer',
    ...overrides,
  }
}

function renderTable(
  rows: SearcherFollowupRow[],
  timezone: string | null = null,
  emptyMessage = 'empty'
) {
  return render(
    <MemoryRouter>
      <SearcherFollowupTable rows={rows} timezone={timezone} emptyMessage={emptyMessage} />
    </MemoryRouter>
  )
}

describe('SearcherFollowupTable', () => {
  it('renders a row per client with all eight columns', () => {
    renderTable([makeRow(), makeRow({ client_id: 84214, inn: '0987654321' })])

    expect(screen.getByText('pages.reports.searcherFollowup.columns.inn')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.searcherFollowup.columns.foundAt')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.searcherFollowup.columns.searcher')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.searcherFollowup.columns.employee')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.searcherFollowup.columns.department')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.reports.searcherFollowup.columns.group')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.searcherFollowup.columns.lastCall')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.searcherFollowup.columns.lastCallOutcome')
    ).toBeInTheDocument()

    expect(screen.getAllByText('Коваленко Іван Петрович')).toHaveLength(2)
    expect(screen.getAllByText('Мельник Ольга Ігорівна')).toHaveLength(2)
    expect(screen.getAllByText('Дайлер')).toHaveLength(2)
    expect(screen.getAllByText('Полка')).toHaveLength(2)
  })

  it('renders exactly as many headers as the exported column count promises', () => {
    // The skeleton of this table is sized from SEARCHER_FOLLOWUP_COLUMN_COUNT
    // while the columns themselves are built inside the component (they need
    // `t`), so this is what catches the two drifting apart.
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader')).toHaveLength(SEARCHER_FOLLOWUP_COLUMN_COUNT)
  })

  it('formats both UTC instants in the profile timezone', () => {
    // A pinned instant in a non-UTC zone: 06:14 UTC = 09:14 in Kyiv summer
    // (+03:00). The card baked this shift into the VALUE; here the API ships
    // UTC and the shift happens at render time, in the PROFILE zone.
    renderTable([makeRow()], 'Europe/Kyiv')

    expect(screen.getByText('12-08-2026 09:14')).toBeInTheDocument()
    expect(screen.getByText('11-08-2026 18:02')).toBeInTheDocument()
  })

  it('formats the instants in a different profile timezone differently', () => {
    // Same payload, another operator profile — proves the zone is read from
    // the prop and not hardcoded anywhere on the way.
    renderTable([makeRow()], 'America/New_York')

    expect(screen.getByText('12-08-2026 02:14')).toBeInTheDocument()
    expect(screen.getByText('11-08-2026 11:02')).toBeInTheDocument()
  })

  it.each([
    // The API ships the RAW telephony value on purpose; the label comes from
    // the app-wide classifier (src/lib/callOutcome.ts), so the expectation is
    // its shared pages.clients.statuses.* key — rendered through the global
    // i18n mock, which maps a few of those keys to readable text and echoes
    // the rest verbatim.
    ['answered', 'Answered'],
    ['no_answer', 'No Answer'],
    ['busy', 'pages.clients.statuses.busy'],
    ['cancel', 'pages.clients.statuses.cancel'],
    ['congestion', 'pages.clients.statuses.congestion'],
    // Outcomes call-service also emits that the feature's former private
    // 5-value table would have shown as raw English tokens — the point of
    // delegating to the shared classifier.
    ['missed', 'pages.clients.statuses.missed'],
    ['rejected', 'pages.clients.statuses.rejected'],
    ['unavailable', 'pages.clients.statuses.unavailable'],
    ['failed', 'Failed'],
  ])('localises the call outcome %s via the shared classifier', (outcome, expected) => {
    renderTable([makeRow({ last_call_outcome: outcome })])

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('shows "Unknown" for a call whose outcome was never recorded', () => {
    // last_call_at set + outcome null = a call happened, result unrecorded —
    // NOT the same as "no call", which the card conflated it with.
    renderTable([makeRow({ last_call_outcome: null })])

    expect(screen.getByText('pages.reports.searcherFollowup.outcome.unknown')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('shows "—" (not "Unknown") when there was no call at all', () => {
    renderTable([makeRow({ last_call_at: null, last_call_outcome: null })])

    // Both the datetime and the outcome cell degrade to the placeholder.
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(
      screen.queryByText('pages.reports.searcherFollowup.outcome.unknown')
    ).not.toBeInTheDocument()
  })

  it.each([[''], ['   ']])(
    'treats a blank outcome (%j) as "no recorded outcome", not as data',
    (outcome) => {
      // The column is a free VARCHAR: an empty or whitespace-only string
      // carries exactly as much information as NULL, and rendering it
      // verbatim would leave a silently empty cell.
      renderTable([makeRow({ last_call_outcome: outcome })])

      expect(screen.getByText('pages.reports.searcherFollowup.outcome.unknown')).toBeInTheDocument()
    }
  )

  it('renders an unrecognised outcome verbatim instead of crashing or lying', () => {
    // The column is a free VARCHAR the telephony layer may grow; a value this
    // build has no label for must show as itself — "Unknown" means "no
    // recorded outcome" and would misreport a real result.
    renderTable([makeRow({ last_call_outcome: 'voicemail' })])

    expect(screen.getByText('voicemail')).toBeInTheDocument()
    expect(
      screen.queryByText('pages.reports.searcherFollowup.outcome.unknown')
    ).not.toBeInTheDocument()
  })

  it('links each row to the client details route built from client_id', () => {
    // The API deliberately ships no link field — a hardcoded production host
    // would be wrong on every other environment (docs/searcher-followup-feed.md).
    renderTable([makeRow()])

    expect(screen.getByRole('link', { name: '1234567890' })).toHaveAttribute(
      'href',
      '/dashboard/clients/84213'
    )
  })

  it('keeps the client link reachable when the tax id is missing', () => {
    renderTable([makeRow({ inn: null })])

    // Visible text degrades to "—", but the link must not be named "—".
    const link = screen.getByRole('link', { name: 'pages.reports.searcherFollowup.openClient' })
    expect(link).toHaveAttribute('href', '/dashboard/clients/84213')
    expect(link).toHaveTextContent('—')
  })

  it('renders "—" for every nullable column', () => {
    renderTable([
      makeRow({
        inn: null,
        searcher_name: null,
        employee_name: null,
        department: null,
        group_name: null,
        last_call_at: null,
        last_call_outcome: null,
      }),
    ])

    // inn, searcher, employee, department, group, last call, outcome
    expect(screen.getAllByText('—')).toHaveLength(7)
  })

  it('shows the supplied empty message when the feed has no rows', () => {
    renderTable([], null, 'pages.reports.searcherFollowup.empty')

    expect(screen.getByText('pages.reports.searcherFollowup.empty')).toBeInTheDocument()
  })

  it('offers no client-side sorting (the order is fixed server-side)', () => {
    renderTable([makeRow()])

    // Card 123 parity: department → group → employee last name → client_id —
    // sorting one page of a server-paginated feed would reorder 50 rows out
    // of the whole feed, so no header is sortable.
    expect(document.querySelectorAll('th.cursor-pointer')).toHaveLength(0)
  })
})
