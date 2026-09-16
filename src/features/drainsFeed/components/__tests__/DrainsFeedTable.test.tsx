import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DRAINS_FEED_COLUMN_COUNT, DrainsFeedTable } from '../DrainsFeedTable'
import type { DrainsFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

function makeRow(overrides: Partial<DrainsFeedRow> = {}): DrainsFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    // A fortnight older than the promised day — the window's axis is the
    // promise, not the conversation that produced it.
    interaction_date: '2026-08-26T06:14:03Z',
    interaction_type: 'Часткова оплата',
    promise_date: '2026-09-11T06:00:00Z',
    promise_amount: '1500.00',
    employee_interacted: 'Коваленко Іван Петрович',
    employee_responsible: 'Мельник Ольга Ігорівна',
    link: 'https://crm-prionex.online/dashboard/clients/84213',
    payment_amount: '0.00',
    last_interaction_date: '2026-09-10',
    last_result: 'Стягнення - Дзвінок',
    department: 'Стягнення',
    group_name: 'Полка',
    ...overrides,
  }
}

function renderTable(
  rows: DrainsFeedRow[],
  props: Partial<Parameters<typeof DrainsFeedTable>[0]> = {}
): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <DrainsFeedTable
        rows={rows}
        timezone={null}
        emptyMessage="pages.reports.drainsFeed.empty"
        {...props}
      />
    </MemoryRouter>
  )
}

describe('DrainsFeedTable', () => {
  it('renders the card’s 13 columns, in the source system’s order — and the skeleton constant matches', () => {
    renderTable([makeRow()])

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual([
      'pages.reports.drainsFeed.columns.inn',
      'pages.reports.drainsFeed.columns.interactionDate',
      'pages.reports.drainsFeed.columns.interactionType',
      'pages.reports.drainsFeed.columns.promiseDate',
      'pages.reports.drainsFeed.columns.promiseAmount',
      'pages.reports.drainsFeed.columns.employeeInteracted',
      'pages.reports.drainsFeed.columns.employeeResponsible',
      'pages.reports.drainsFeed.columns.link',
      'pages.reports.drainsFeed.columns.paymentAmount',
      'pages.reports.drainsFeed.columns.lastInteractionDate',
      'pages.reports.drainsFeed.columns.lastResult',
      'pages.reports.drainsFeed.columns.department',
      'pages.reports.drainsFeed.columns.group',
    ])
    // The pair that keeps the tab's TableSkeleton honest (see the constant's
    // docblock) — count the DOM, not the array, so a column lost in render
    // still fails here.
    expect(headers).toHaveLength(DRAINS_FEED_COLUMN_COUNT)
  })

  it('carries BOTH money columns — the promise and what was actually paid', () => {
    // The gate of the whole report is `promise_amount > payment_amount`, so a
    // copy from the callbacks feed (which has no money at all) would drop the
    // two columns that explain why every row is in the list.
    renderTable([makeRow()])

    expect(screen.getByText('1,500.00')).toBeInTheDocument()
    expect(screen.getByText('0.00')).toBeInTheDocument()
  })

  it('renders a ZERO payment as a number, never as a dash', () => {
    // Zero is the majority value here — "promised and paid nothing" is the
    // report. A nullable-column placeholder would read as missing data on most
    // rows.
    renderTable([makeRow({ payment_amount: '0.00' })])

    expect(screen.getByText('0.00')).toBeInTheDocument()
  })

  it('renders a NEGATIVE payment (a reversal) as the number it is', () => {
    // Payments may be reversals: 1 207 negative movements on production. The
    // cell must not swallow the sign — `hide_paid` treats such a client as
    // "paid" (non-zero), so the column is the only place the operator can see
    // why.
    renderTable([makeRow({ payment_amount: '-250.00' })])

    expect(screen.getByText('-250.00')).toBeInTheDocument()
  })

  it('renders both datetime columns with the date AND the time, in the given timezone', () => {
    // 06:00 UTC = 09:00 Kyiv summer time. Not cosmetic on this card: 11.98 % of
    // its promises change their calendar DAY under the shift the source card
    // baked into the value, so a date-only cell would hide exactly the rows
    // where the zone matters.
    renderTable([makeRow()], { timezone: 'Europe/Kyiv' })

    expect(screen.getByText('11-09-2026 09:00')).toBeInTheDocument()
    // The conversation is a fortnight older than the promised day — the window
    // cuts by the promise, not by this column.
    expect(screen.getByText('26-08-2026 09:14')).toBeInTheDocument()
  })

  it('renders the last interaction date as a bare DAY, identical in every timezone', () => {
    // A calendar day, not an instant: the string is sliced rather than parsed,
    // so a viewer west of UTC sees the same 10-09-2026 as one in Kyiv. Passing
    // an extreme zone here is what would catch a `new Date(...)` regression.
    renderTable([makeRow()], { timezone: 'Pacific/Midway' })

    expect(screen.getByText('10-09-2026')).toBeInTheDocument()
  })

  it('renders a datetime-tailed last interaction date as the same day, not the previous one', () => {
    // Defence against the payload ever shipping the day with a time tail, and
    // the ONE value that actually discriminates the two implementations while
    // the suite runs on the pinned UTC host (vitest.config.ts): this instant is
    // 2026-09-10T21:00Z, so a `new Date(...)` path would read back 10-09-2026
    // while slicing keeps the day the payload states.
    renderTable([makeRow({ last_interaction_date: '2026-09-11T02:00:00+05:00' })], {
      timezone: 'Pacific/Midway',
    })

    expect(screen.getByText('11-09-2026')).toBeInTheDocument()
    expect(screen.queryByText('10-09-2026')).not.toBeInTheDocument()
  })

  it('links the row to the client details route built from client_id', () => {
    // The payload's `link` field (backend absolute URL, production host by
    // default) is deliberately NOT rendered — the internal route from
    // `client_id` is env-correct and an in-app navigation, like the sibling
    // feeds (PromisesFeedTable, CallbacksFeedTable).
    renderTable([makeRow()])

    const link = screen.getByRole('link', { name: 'pages.reports.drainsFeed.openClient' })
    expect(link).toHaveAttribute('href', '/dashboard/clients/84213')
    // A router Link is an in-app navigation, not a new-tab page load.
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it('labels a NULL department «Без відділу» instead of a dash — 9.3 % of rows, all owing money', () => {
    renderTable([makeRow({ department: null })])

    expect(screen.getByText('pages.reports.drainsFeed.columns.noDepartment')).toBeInTheDocument()
  })

  it('labels a whitespace-only department «Без відділу» too (the directory yields blanks, not nulls)', () => {
    // Same trim rule as both money siblings: the auth-service directory yields
    // whitespace rather than null for an unfilled entry, and a `?? label`
    // fallback alone would render invisible empty text.
    renderTable([makeRow({ department: '   ' })])

    expect(screen.getByText('pages.reports.drainsFeed.columns.noDepartment')).toBeInTheDocument()
  })

  it('renders "—" for the nullable text columns, an unworked (empty) last_result and a missing day', () => {
    renderTable([
      makeRow({
        inn: null,
        interaction_type: null,
        employee_interacted: null,
        employee_responsible: null,
        last_interaction_date: null,
        // Empty means "nobody touched this client today" — a state, not a
        // missing value, and the MAJORITY of rows in the morning; it must read
        // as the shared placeholder, not as invisible empty text.
        last_result: '',
        // 17.6 % of production rows have no group — the dash is the shared
        // convention for it, unlike the department's own label.
        group_name: null,
      }),
    ])

    // inn, interaction_type, employee_interacted, employee_responsible,
    // last_interaction_date, last_result, group_name.
    expect(screen.getAllByText('—')).toHaveLength(7)
    // …and the two money cells are NOT among them.
    expect(screen.getByText('1,500.00')).toBeInTheDocument()
    expect(screen.getByText('0.00')).toBeInTheDocument()
  })

  it('shows the empty message for a feed with no rows', () => {
    renderTable([])

    expect(screen.getByText('pages.reports.drainsFeed.empty')).toBeInTheDocument()
  })
})
