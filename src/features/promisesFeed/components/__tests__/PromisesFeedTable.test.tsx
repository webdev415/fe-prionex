import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PROMISES_FEED_COLUMN_COUNT, PromisesFeedTable } from '../PromisesFeedTable'
import type { PromisesFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key
// and i18n.language is 'en', so money renders 1,234.56.

function makeRow(overrides: Partial<PromisesFeedRow> = {}): PromisesFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    interaction_date: '2026-09-05T06:14:03Z',
    interaction_type: 'Домовленість про оплату',
    promise_date: '2026-09-08T06:00:00Z',
    promise_amount: '1500.00',
    employee_interacted: 'Коваленко Іван Петрович',
    employee_responsible: 'Мельник Ольга Ігорівна',
    link: 'https://crm-prionex.online/dashboard/clients/84213',
    payment_amount: '0.00',
    last_result: 'Стягнення - Дзвінок',
    department: 'Стягнення',
    group_name: 'Полка',
    ...overrides,
  }
}

function renderTable(
  rows: PromisesFeedRow[],
  props: Partial<Parameters<typeof PromisesFeedTable>[0]> = {}
): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <PromisesFeedTable
        rows={rows}
        timezone={null}
        emptyMessage="pages.reports.promisesFeed.empty"
        {...props}
      />
    </MemoryRouter>
  )
}

describe('PromisesFeedTable', () => {
  it('renders the card’s 12 columns, in order — and the skeleton constant matches', () => {
    renderTable([makeRow()])

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual([
      'pages.reports.promisesFeed.columns.inn',
      'pages.reports.promisesFeed.columns.interactionDate',
      'pages.reports.promisesFeed.columns.interactionType',
      'pages.reports.promisesFeed.columns.promiseDate',
      'pages.reports.promisesFeed.columns.promiseAmount',
      'pages.reports.promisesFeed.columns.employeeInteracted',
      'pages.reports.promisesFeed.columns.employeeResponsible',
      'pages.reports.promisesFeed.columns.link',
      'pages.reports.promisesFeed.columns.paymentAmount',
      'pages.reports.promisesFeed.columns.lastResult',
      'pages.reports.promisesFeed.columns.department',
      'pages.reports.promisesFeed.columns.group',
    ])
    // The pair that keeps the tab's TableSkeleton honest (see the constant's
    // docblock) — count the DOM, not the array, so a column lost in render
    // still fails here.
    expect(headers).toHaveLength(PROMISES_FEED_COLUMN_COUNT)
  })

  it('renders both datetime columns with the date AND the time, in the given timezone', () => {
    // 06:00 UTC = 09:00 Kyiv summer time — the card's typical morning promise.
    // A date-only rendering would collapse the 09:00/12:30/21:00 promises of
    // one day into indistinguishable rows.
    renderTable([makeRow()], { timezone: 'Europe/Kyiv' })

    expect(screen.getByText('08-09-2026 09:00')).toBeInTheDocument()
    expect(screen.getByText('05-09-2026 09:14')).toBeInTheDocument()
  })

  it('formats both money columns with locale grouping and two decimals', () => {
    renderTable([makeRow({ promise_amount: '112062.00', payment_amount: '1500.5' })])

    expect(screen.getByText('112,062.00')).toBeInTheDocument()
    expect(screen.getByText('1,500.50')).toBeInTheDocument()
  })

  it('links the row to the client details route built from client_id', () => {
    // The payload's `link` field (backend absolute URL, production host by
    // default) is deliberately NOT rendered — the internal route from
    // `client_id` is env-correct and an in-app navigation, like the sibling
    // feeds (SearcherFollowupTable, InboundFollowupTable).
    renderTable([makeRow()])

    const link = screen.getByRole('link', { name: 'pages.reports.promisesFeed.openClient' })
    expect(link).toHaveAttribute('href', '/dashboard/clients/84213')
    // A router Link is an in-app navigation, not a new-tab page load.
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it('renders "—" for a payment amount that cannot be parsed as a number', () => {
    // Pins formatMoneyAmount's NaN path through the cell: a broken payload
    // value must read as the shared placeholder, never as "NaN".
    renderTable([makeRow({ payment_amount: 'abc' })])

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('NaN')).not.toBeInTheDocument()
  })

  it('labels a NULL department «Без відділу» instead of a dash — those rows carry real promises', () => {
    renderTable([makeRow({ department: null })])

    expect(screen.getByText('pages.reports.promisesFeed.columns.noDepartment')).toBeInTheDocument()
  })

  it('labels a whitespace-only department «Без відділу» too (the directory yields blanks, not nulls)', () => {
    // Same trim rule as the promises-daily matrix: the auth-service directory
    // yields whitespace rather than null for an unfilled entry, and a
    // `?? label` fallback alone would render invisible empty text.
    renderTable([makeRow({ department: '   ' })])

    expect(screen.getByText('pages.reports.promisesFeed.columns.noDepartment')).toBeInTheDocument()
  })

  it('renders "—" for the nullable text columns and for an unworked (empty) last_result', () => {
    renderTable([
      makeRow({
        inn: null,
        interaction_type: null,
        employee_interacted: null,
        employee_responsible: null,
        // Empty means "not worked today" — a state, not a missing value; it
        // must read as the shared placeholder, not as invisible empty text.
        last_result: '',
        group_name: null,
      }),
    ])

    // inn, interaction_type, employee_interacted, employee_responsible,
    // last_result, group_name.
    expect(screen.getAllByText('—')).toHaveLength(6)
  })

  it('keeps duplicate rows apart — the same client can promise twice in one window', () => {
    // No unique business id exists (Card 119 parity: several interactions per
    // chain instance ship several rows, same client_id included); the
    // `${client_id}-${index}` DataTable id must render them all rather than
    // collapse them.
    renderTable([makeRow(), makeRow()])

    expect(screen.getAllByText('1234567890')).toHaveLength(2)
  })

  it('shows the empty message for a feed with no rows', () => {
    renderTable([])

    expect(screen.getByText('pages.reports.promisesFeed.empty')).toBeInTheDocument()
  })
})
