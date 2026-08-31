import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CONTACT_TAG_COLUMN_COUNT, ContactTagTable } from '../ContactTagTable'
import type { ContactTagFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key
// and i18n.language is 'en'. formatCalendarDay (@/lib/calendarDay) and
// formatMoneyAmount (@/lib/localeFormat) are real, so the day/money rendering
// below exercises the actual Intl path, not a stub.

function makeRow(overrides: Partial<ContactTagFeedRow> = {}): ContactTagFeedRow {
  return {
    client_id: 421395,
    inn: '3210987654',
    tag_code: 'nekontakt',
    tag_name: 'Неконтакт',
    sell_date: '2026-03-11',
    assignment_date: '2026-06-02',
    last_planed_interaction_date: null,
    employee_id: 6971,
    employee_name: 'Коваленко Іван Петрович',
    body_amount: '15000.00',
    last_interaction_date: '2026-08-14',
    department: 'Стягнення',
    group_name: 'Група №3',
    ...overrides,
  }
}

function renderTable(rows: ContactTagFeedRow[], emptyMessage = 'empty') {
  return render(
    <MemoryRouter>
      <ContactTagTable rows={rows} emptyMessage={emptyMessage} />
    </MemoryRouter>
  )
}

describe('ContactTagTable', () => {
  it('renders a row per client with all ten columns', () => {
    renderTable([makeRow(), makeRow({ client_id: 421396, inn: '0987654321' })])

    for (const column of [
      'inn',
      'tag',
      'sellDate',
      'assignmentDate',
      'lastPlanned',
      'employee',
      'department',
      'group',
      'lastInteraction',
      'bodyAmount',
    ]) {
      expect(screen.getByText(`pages.reports.contactTag.columns.${column}`)).toBeInTheDocument()
    }

    expect(screen.getAllByText('Коваленко Іван Петрович')).toHaveLength(2)
    expect(screen.getAllByText('Стягнення')).toHaveLength(2)
    expect(screen.getAllByText('Група №3')).toHaveLength(2)
  })

  it('renders exactly as many headers as the exported column count promises', () => {
    // The skeleton of this table is sized from CONTACT_TAG_COLUMN_COUNT while
    // the columns themselves are built inside the component (they need `t`), so
    // this is what catches the two drifting apart.
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader')).toHaveLength(CONTACT_TAG_COLUMN_COUNT)
  })

  it('renders the 13 contract fields as 10 columns — no id column, no code column', () => {
    // client_id becomes the link, employee_id is a join key the card never
    // showed, and tag_code drives the sub-tabs rather than a column that would
    // print «nekontakt» next to «Неконтакт» in every row.
    renderTable([makeRow()])

    expect(screen.queryByText('421395')).not.toBeInTheDocument()
    expect(screen.queryByText('6971')).not.toBeInTheDocument()
    expect(screen.queryByText('nekontakt')).not.toBeInTheDocument()
  })

  it('shows the tag by its LIVE localized name, not by its code', () => {
    // A rename in the tag directory shows up here immediately; the sub-tabs go
    // on filtering because they key on the code (utils/tagTabs.ts).
    renderTable([makeRow({ tag_code: 'kontakt', tag_name: 'Контакт' })])

    expect(screen.getByText('Контакт')).toBeInTheDocument()
  })

  it('degrades a missing tag label to "—" rather than falling back to the code', () => {
    // The backend nulls that ONE cell when the directory ships a non-string
    // label. Printing the raw code instead would put a machine token in an
    // operator's work list.
    renderTable([makeRow({ tag_name: null })])

    expect(screen.queryByText('nekontakt')).not.toBeInTheDocument()
    // the tag + the null promise date
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders every date column as its own calendar day, unshifted', () => {
    // Four backend DATEs cut in three different zones server-side (the
    // requested timezone for assignment/promise, UTC for the last interaction,
    // none at all for the sale date). Parsed as UTC midnight they would render
    // as the previous day west of Greenwich.
    renderTable([makeRow({ last_planed_interaction_date: '2026-08-01' })])

    expect(screen.getByText('03/11/2026')).toBeInTheDocument() // sell_date
    expect(screen.getByText('06/02/2026')).toBeInTheDocument() // assignment_date
    expect(screen.getByText('08/14/2026')).toBeInTheDocument() // last_interaction_date
    expect(screen.getByText('08/01/2026')).toBeInTheDocument() // last_planed_interaction_date
  })

  it('renders the Decimal-as-string debt amount as money with two decimals', () => {
    // body_amount arrives as a JSON STRING ("15000.00") because money is an
    // exact Decimal server-side — coercing it earlier is where a cent is lost.
    renderTable([makeRow()])

    expect(screen.getByText('15,000.00')).toBeInTheDocument()
  })

  it('renders "—" for an unparseable debt amount instead of "NaN"', () => {
    renderTable([makeRow({ body_amount: 'not-a-number' })])

    // the amount + the null promise date
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders "—" for the promise date of a row nobody extracted a promise from', () => {
    // The common case, and the reason the client is in this feed at all: a
    // client with a FUTURE promise (or a promised call-back) is excluded.
    renderTable([makeRow()])

    expect(screen.getAllByText('—')).toHaveLength(1)
  })

  it('renders "—" for every nullable column', () => {
    renderTable([
      makeRow({
        inn: null,
        tag_name: null,
        sell_date: null,
        last_planed_interaction_date: null,
        employee_name: null,
        department: null,
        group_name: null,
      }),
    ])

    // inn, tag, sell, promise, employee, department, group — seven of the ten.
    // assignment_date, last_interaction_date and body_amount are structurally
    // non-NULL: the population filter cannot admit a row without them.
    expect(screen.getAllByText('—')).toHaveLength(7)
  })

  it('renders the card’s "shelf" display overrides as the plain strings they are', () => {
    // Unlike the sibling Card 125 feed (where every account they name is also
    // blacklisted and the branches are dead), this card's blacklist is five ids
    // and holds none of the four shelf accounts — so these ARE live values and
    // nothing here filters on them.
    renderTable([makeRow({ department: 'Дайлер', group_name: 'Полка' })])

    expect(screen.getByText('Дайлер')).toBeInTheDocument()
    expect(screen.getByText('Полка')).toBeInTheDocument()
  })

  it('links each row to the client details route built from client_id', () => {
    // The API deliberately ships no link field — a hardcoded production host
    // would be wrong on every other environment (docs/contact-tag-feed.md).
    renderTable([makeRow()])

    expect(screen.getByRole('link', { name: '3210987654' })).toHaveAttribute(
      'href',
      '/dashboard/clients/421395'
    )
  })

  it('keeps the client link reachable when the tax id is missing', () => {
    renderTable([makeRow({ inn: null })])

    // Visible text degrades to "—", but the link must not be named "—".
    const link = screen.getByRole('link', { name: 'pages.reports.contactTag.openClient' })
    expect(link).toHaveAttribute('href', '/dashboard/clients/421395')
    expect(link).toHaveTextContent('—')
  })

  it('shows the supplied empty message when the feed has no rows', () => {
    renderTable([], 'pages.reports.contactTag.empty')

    expect(screen.getByText('pages.reports.contactTag.empty')).toBeInTheDocument()
  })

  it('offers no client-side sorting (the order is fixed server-side)', () => {
    renderTable([makeRow()])

    // Card 124 parity: employee name → last_interaction_date DESC → client_id.
    // Sorting one page of an ~880-page feed would reorder 50 rows out of 44 000.
    expect(document.querySelectorAll('th.cursor-pointer')).toHaveLength(0)
  })

  it('renders rows in the order given, without regrouping by tag', () => {
    // The strip filters; it never re-sorts. The server's order interleaves the
    // two tags inside one employee's block and that is the order operators work.
    renderTable([
      makeRow({ client_id: 1, inn: '111', tag_code: 'kontakt', tag_name: 'Контакт' }),
      makeRow({ client_id: 2, inn: '222', tag_code: 'nekontakt' }),
      makeRow({ client_id: 3, inn: '333', tag_code: 'kontakt', tag_name: 'Контакт' }),
    ])

    const links = screen.getAllByRole('link').map((link) => link.textContent)
    expect(links).toEqual(['111', '222', '333'])
  })
})
