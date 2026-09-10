import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CALLBACKS_FEED_COLUMN_COUNT, CallbacksFeedTable } from '../CallbacksFeedTable'
import type { CallbacksFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

function makeRow(overrides: Partial<CallbacksFeedRow> = {}): CallbacksFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    interaction_date: '2026-08-26T06:14:03Z',
    interaction_type: 'Передзвонити',
    promise_date: '2026-09-09T06:00:00Z',
    employee_interacted: 'Коваленко Іван Петрович',
    employee_responsible: 'Мельник Ольга Ігорівна',
    link: 'https://crm-prionex.online/dashboard/clients/84213',
    last_interaction_date: '2026-09-08',
    last_result: 'Стягнення - Дзвінок',
    department: 'Стягнення',
    group_name: 'Полка',
    ...overrides,
  }
}

function renderTable(
  rows: CallbacksFeedRow[],
  props: Partial<Parameters<typeof CallbacksFeedTable>[0]> = {}
): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <CallbacksFeedTable
        rows={rows}
        timezone={null}
        emptyMessage="pages.reports.callbacksFeed.empty"
        {...props}
      />
    </MemoryRouter>
  )
}

describe('CallbacksFeedTable', () => {
  it('renders the card’s 11 columns, in order — and the skeleton constant matches', () => {
    renderTable([makeRow()])

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual([
      'pages.reports.callbacksFeed.columns.inn',
      'pages.reports.callbacksFeed.columns.interactionDate',
      'pages.reports.callbacksFeed.columns.interactionType',
      'pages.reports.callbacksFeed.columns.promiseDate',
      'pages.reports.callbacksFeed.columns.employeeInteracted',
      'pages.reports.callbacksFeed.columns.employeeResponsible',
      'pages.reports.callbacksFeed.columns.link',
      'pages.reports.callbacksFeed.columns.lastInteractionDate',
      'pages.reports.callbacksFeed.columns.lastResult',
      'pages.reports.callbacksFeed.columns.department',
      'pages.reports.callbacksFeed.columns.group',
    ])
    // The pair that keeps the tab's TableSkeleton honest (see the constant's
    // docblock) — count the DOM, not the array, so a column lost in render
    // still fails here.
    expect(headers).toHaveLength(CALLBACKS_FEED_COLUMN_COUNT)
  })

  it('carries no money column — the only feed of its family without one', () => {
    // Card 121 ships neither `promise_amount` nor `payment_amount`; a column
    // copied over from the promises feed would show a blank or "NaN" cell
    // forever, so the absence is pinned rather than left to review.
    renderTable([makeRow()])

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).not.toContain('pages.reports.callbacksFeed.columns.promiseAmount')
    expect(headers).not.toContain('pages.reports.callbacksFeed.columns.paymentAmount')
  })

  it('renders both datetime columns with the date AND the time, in the given timezone', () => {
    // 06:00 UTC = 09:00 Kyiv summer time — the typical morning callback slot.
    // A date-only rendering would collapse a whole day's call plan into
    // indistinguishable rows.
    renderTable([makeRow()], { timezone: 'Europe/Kyiv' })

    expect(screen.getByText('09-09-2026 09:00')).toBeInTheDocument()
    // The interaction is a fortnight older than the scheduled call — the
    // window cuts by the callback, not by this column.
    expect(screen.getByText('26-08-2026 09:14')).toBeInTheDocument()
  })

  it('renders the last interaction date as a bare DAY, identical in every timezone', () => {
    // A calendar day, not an instant: the string is sliced rather than parsed,
    // so a viewer west of UTC sees the same 08-09-2026 as one in Kyiv. Passing
    // an extreme zone here is what would catch a `new Date(...)` regression.
    renderTable([makeRow()], { timezone: 'Pacific/Midway' })

    expect(screen.getByText('08-09-2026')).toBeInTheDocument()
  })

  it('renders a datetime-tailed last interaction date as the same day, not the previous one', () => {
    // Defence against the payload ever shipping the day with a time tail, and
    // the ONE value that actually discriminates the two implementations while
    // the suite runs on the pinned UTC host (vitest.config.ts): this instant
    // is 2026-09-08T21:00Z, so `formatDate`'s `new Date(...)` path would read
    // back 08-09-2026, while slicing the string keeps the day the payload
    // states. A `T00:00:00Z` tail proves nothing here — under UTC both paths
    // agree, which is why the earlier version of this test passed against a
    // build with the regression in it.
    renderTable([makeRow({ last_interaction_date: '2026-09-09T02:00:00+05:00' })], {
      timezone: 'Pacific/Midway',
    })

    expect(screen.getByText('09-09-2026')).toBeInTheDocument()
    expect(screen.queryByText('08-09-2026')).not.toBeInTheDocument()
  })

  it('links the row to the client details route built from client_id', () => {
    // The payload's `link` field (backend absolute URL, production host by
    // default) is deliberately NOT rendered — the internal route from
    // `client_id` is env-correct and an in-app navigation, like the sibling
    // feeds (PromisesFeedTable, SearcherFollowupTable).
    renderTable([makeRow()])

    const link = screen.getByRole('link', { name: 'pages.reports.callbacksFeed.openClient' })
    expect(link).toHaveAttribute('href', '/dashboard/clients/84213')
    // A router Link is an in-app navigation, not a new-tab page load.
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it('labels a NULL department «Без відділу» instead of a dash — those rows carry real callbacks', () => {
    renderTable([makeRow({ department: null })])

    expect(screen.getByText('pages.reports.callbacksFeed.columns.noDepartment')).toBeInTheDocument()
  })

  it('labels a whitespace-only department «Без відділу» too (the directory yields blanks, not nulls)', () => {
    // Same trim rule as the promises feed: the auth-service directory yields
    // whitespace rather than null for an unfilled entry, and a `?? label`
    // fallback alone would render invisible empty text.
    renderTable([makeRow({ department: '   ' })])

    expect(screen.getByText('pages.reports.callbacksFeed.columns.noDepartment')).toBeInTheDocument()
  })

  it('renders "—" for the nullable text columns, an unworked (empty) last_result and a missing day', () => {
    renderTable([
      makeRow({
        inn: null,
        interaction_type: null,
        employee_interacted: null,
        employee_responsible: null,
        last_interaction_date: null,
        // Empty means "not worked today" — a state, not a missing value, and
        // the MAJORITY of rows in the morning; it must read as the shared
        // placeholder, not as invisible empty text.
        last_result: '',
        group_name: null,
      }),
    ])

    // inn, interaction_type, employee_interacted, employee_responsible,
    // last_interaction_date, last_result, group_name.
    expect(screen.getAllByText('—')).toHaveLength(7)
  })

  it('keeps duplicate rows apart — the same client can be scheduled several times in one window', () => {
    // No unique business id exists (Card 121 parity: a row is an INTERACTION,
    // and a production probe found up to four per client); the
    // `${client_id}-${index}` DataTable id must render them all rather than
    // collapse them.
    renderTable([makeRow(), makeRow()])

    expect(screen.getAllByText('1234567890')).toHaveLength(2)
  })

  it('shows the empty message for a feed with no rows', () => {
    renderTable([])

    expect(screen.getByText('pages.reports.callbacksFeed.empty')).toBeInTheDocument()
  })
})
