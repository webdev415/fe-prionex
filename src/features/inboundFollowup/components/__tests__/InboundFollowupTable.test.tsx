import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { INBOUND_FOLLOWUP_COLUMN_COUNT, InboundFollowupTable } from '../InboundFollowupTable'
import type { InboundFollowupRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
// formatDateTime (@/lib/formatters) is real, so the timezone rendering below
// exercises the actual Intl path, not a stub.

function makeRow(overrides: Partial<InboundFollowupRow> = {}): InboundFollowupRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    interaction_at: '2026-08-12T06:14:03Z',
    interaction_type: 'Питання щодо спец.пропозицій',
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
  rows: InboundFollowupRow[],
  timezone: string | null = null,
  emptyMessage = 'empty'
) {
  return render(
    <MemoryRouter>
      <InboundFollowupTable rows={rows} timezone={timezone} emptyMessage={emptyMessage} />
    </MemoryRouter>
  )
}

describe('InboundFollowupTable', () => {
  it('renders a row per client with all eight columns', () => {
    renderTable([makeRow(), makeRow({ client_id: 84214, inn: '0987654321' })])

    expect(screen.getByText('pages.reports.inboundFollowup.columns.inn')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.inboundFollowup.columns.interactionAt')
    ).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.inboundFollowup.columns.interactionType')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.reports.inboundFollowup.columns.employee')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.inboundFollowup.columns.department')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.inboundFollowup.columns.group')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.inboundFollowup.columns.lastCall')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.inboundFollowup.columns.lastCallOutcome')
    ).toBeInTheDocument()

    expect(screen.getAllByText('Коваленко Іван Петрович')).toHaveLength(2)
    expect(screen.getAllByText('Питання щодо спец.пропозицій')).toHaveLength(2)
    expect(screen.getAllByText('Дайлер')).toHaveLength(2)
    expect(screen.getAllByText('Полка')).toHaveLength(2)
  })

  it('renders exactly as many headers as the exported column count promises', () => {
    // The skeleton of this table is sized from INBOUND_FOLLOWUP_COLUMN_COUNT
    // while the columns themselves are built inside the component (they need
    // `t`), so this is what catches the two drifting apart.
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader')).toHaveLength(INBOUND_FOLLOWUP_COLUMN_COUNT)
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

  it('never renders the response stamp as a freshness line', () => {
    // The endpoint has NO result cache, so `generated_at` is always "just now"
    // — the table is not even given it, and must not grow a "data as of …"
    // line that would state a fact no computation backs.
    renderTable([makeRow()])

    expect(screen.queryByText(/generated|Оновлено|as of/i)).not.toBeInTheDocument()
  })

  it.each([
    // The API ships the RAW telephony value on purpose; the label comes from
    // the app-wide classifier (src/lib/callOutcome.ts) through the shared feed
    // resolver, so the expectation is its pages.clients.statuses.* key —
    // rendered through the global i18n mock, which maps a few of those keys to
    // readable text and echoes the rest verbatim. The first five are the closed
    // domain the backend probed across the whole call_records table.
    ['answered', 'Answered'],
    ['no_answer', 'No Answer'],
    ['busy', 'pages.clients.statuses.busy'],
    ['cancel', 'pages.clients.statuses.cancel'],
    ['congestion', 'pages.clients.statuses.congestion'],
    // Outcomes call-service also emits — inherited for free by delegating to
    // the shared classifier rather than mapping the card's five by hand.
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
    // NOT the same as "no call", which the card conflated it with (its CASE
    // collapsed NULL to an empty string).
    renderTable([makeRow({ last_call_outcome: null })])

    expect(screen.getByText('pages.reports.inboundFollowup.outcome.unknown')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('shows "—" (not "Unknown") when there was no call at all', () => {
    // The MAJORITY case for this feed: 89 % of rows have a responsible employee
    // with no telephony seat and 94 % have no call (probe 2026-08-25). Two
    // blank cells are correct output, so they degrade to the plain shared
    // placeholder — no hint, no badge, nothing that reads as a fault.
    renderTable([makeRow({ last_call_at: null, last_call_outcome: null })])

    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(
      screen.queryByText('pages.reports.inboundFollowup.outcome.unknown')
    ).not.toBeInTheDocument()
  })

  it.each([[''], ['   ']])(
    'treats a blank outcome (%j) as "no recorded outcome", not as data',
    (outcome) => {
      // The column is a free VARCHAR: an empty or whitespace-only string
      // carries exactly as much information as NULL, and rendering it
      // verbatim would leave a silently empty cell.
      renderTable([makeRow({ last_call_outcome: outcome })])

      expect(screen.getByText('pages.reports.inboundFollowup.outcome.unknown')).toBeInTheDocument()
    }
  )

  it('renders an unrecognised outcome verbatim instead of crashing or lying', () => {
    // The column is a free VARCHAR the telephony layer may grow; a value this
    // build has no label for must show as itself — "Unknown" means "no
    // recorded outcome" and would misreport a real result.
    renderTable([makeRow({ last_call_outcome: 'voicemail' })])

    expect(screen.getByText('voicemail')).toBeInTheDocument()
    expect(
      screen.queryByText('pages.reports.inboundFollowup.outcome.unknown')
    ).not.toBeInTheDocument()
  })

  it('links each row to the client details route built from client_id', () => {
    // The API deliberately ships no link field — a hardcoded production host
    // would be wrong on every other environment (docs/inbound-followup-feed.md).
    renderTable([makeRow()])

    expect(screen.getByRole('link', { name: '1234567890' })).toHaveAttribute(
      'href',
      '/dashboard/clients/84213'
    )
  })

  it('keeps the client link reachable when the tax id is missing', () => {
    renderTable([makeRow({ inn: null })])

    // Visible text degrades to "—", but the link must not be named "—".
    const link = screen.getByRole('link', { name: 'pages.reports.inboundFollowup.openClient' })
    expect(link).toHaveAttribute('href', '/dashboard/clients/84213')
    expect(link).toHaveTextContent('—')
  })

  it('renders "—" for every nullable column', () => {
    renderTable([
      makeRow({
        inn: null,
        interaction_type: null,
        employee_name: null,
        department: null,
        group_name: null,
        last_call_at: null,
        last_call_outcome: null,
      }),
    ])

    // inn, request reason, employee, department, group, last call, outcome
    expect(screen.getAllByText('—')).toHaveLength(7)
  })

  it('shows the supplied empty message when the feed has no rows', () => {
    renderTable([], null, 'pages.reports.inboundFollowup.empty')

    expect(screen.getByText('pages.reports.inboundFollowup.empty')).toBeInTheDocument()
  })

  it('offers no client-side sorting (the order is fixed server-side)', () => {
    renderTable([makeRow()])

    // Card 122 parity: department → group → employee last name → client_id —
    // sorting one page of a server-paginated feed would reorder 50 rows out
    // of the whole feed, so no header is sortable.
    expect(document.querySelectorAll('th.cursor-pointer')).toHaveLength(0)
  })
})
