import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OUTBOUND_CALLS_COLUMN_COUNT, OutboundCallsTable } from '../OutboundCallsTable'
import type { OutboundCallsReportRow } from '../../types'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key
// and i18n.language is 'en'. formatNumber (@/lib/localeFormat) is real, so the
// number rendering below exercises the actual Intl path, not a stub.

function makeRow(overrides: Partial<OutboundCallsReportRow> = {}): OutboundCallsReportRow {
  return {
    user_id: 101,
    fio: 'Іваненко Іван Іванович',
    sip: '2060',
    full_count: 288,
    env_count: 186,
    answer_count: 74,
    answer_percent: 25.69,
    quality_count: 31,
    quality_percent: 10.76,
    answer_duration_seconds: 4090,
    quality_duration_seconds: 3600,
    avg_duration_per_call_seconds: 14,
    avg_duration_per_answered_seconds: 55,
    department: 'Стягнення',
    group: 'Група №2',
    ...overrides,
  }
}

function renderTable(rows: OutboundCallsReportRow[], emptyMessage = 'empty') {
  return render(<OutboundCallsTable rows={rows} emptyMessage={emptyMessage} />)
}

/**
 * The fourteen columns IN RENDER ORDER: who dialled, how much, how much of it
 * connected, how long it lasted, and where the seat sits in the org. The order
 * is asserted, not just the membership — the two counter/percent pairs and the
 * two averages are only distinguishable by position for a reader scanning left
 * to right.
 */
const COLUMN_KEYS = [
  'operator',
  'sip',
  'fullCount',
  'envCount',
  'answerCount',
  'answerPercent',
  'qualityCount',
  'qualityPercent',
  'answerDuration',
  'qualityDuration',
  'avgPerCall',
  'avgPerAnswered',
  'department',
  'group',
]

const COLUMN_LABEL_KEYS = COLUMN_KEYS.map((key) => `pages.reports.outboundCalls.columns.${key}`)

describe('OutboundCallsTable', () => {
  it('renders all fourteen columns of the contract, in sequence', () => {
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(
      COLUMN_LABEL_KEYS
    )
  })

  it('renders exactly as many headers as the exported column count promises', () => {
    // The skeleton of this table is sized from OUTBOUND_CALLS_COLUMN_COUNT
    // while the columns themselves are built inside the component (they need
    // `t`), so this is what catches the two drifting apart.
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader')).toHaveLength(OUTBOUND_CALLS_COLUMN_COUNT)
  })

  it('does not show user_id — it is a join key, not a column', () => {
    renderTable([makeRow()])

    expect(screen.queryByText('101')).not.toBeInTheDocument()
  })

  it('renders the counters and both percents of a row', () => {
    renderTable([makeRow()])

    expect(screen.getByText('288')).toBeInTheDocument() // full_count
    expect(screen.getByText('186')).toBeInTheDocument() // env_count
    expect(screen.getByText('74')).toBeInTheDocument() // answer_count
    expect(screen.getByText('25.69%')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument() // quality_count
    expect(screen.getByText('10.76%')).toBeInTheDocument()
  })

  it('renders the four duration columns as HH:MM:SS from seconds', () => {
    renderTable([makeRow()])

    expect(screen.getByText('01:08:10')).toBeInTheDocument() // answer_duration
    expect(screen.getByText('01:00:00')).toBeInTheDocument() // quality_duration
    expect(screen.getByText('00:00:14')).toBeInTheDocument() // avg per call
    expect(screen.getByText('00:00:55')).toBeInTheDocument() // avg per answered
  })

  it('renders a talk sum past 24 hours without wrapping it', () => {
    // What the source card gets wrong: its cast to `time` returns the
    // remainder modulo a day, so a 25-hour month reads as one hour.
    renderTable([makeRow({ answer_duration_seconds: 90_061 })])

    expect(screen.getByText('25:01:01')).toBeInTheDocument()
    expect(screen.queryByText('01:01:01')).not.toBeInTheDocument()
  })

  it('renders "—" for a null average conversation, and only for that column', () => {
    // A seat that connected nothing has no average conversation; "00:00:00"
    // would read as "every call was instant".
    renderTable([makeRow({ answer_count: 0, avg_duration_per_answered_seconds: null })])

    expect(screen.getAllByText('—')).toHaveLength(1)
    expect(screen.getByText('00:00:14')).toBeInTheDocument() // avg per call survives
  })

  it('falls back to the extension when the directory does not know the seat', () => {
    // `user_id`, `fio`, `department` and `group` are null together — the row
    // stays, because the calls happened.
    renderTable([makeRow({ user_id: null, fio: null, department: null, group: null })])

    // Once as the operator label, once in its own SIP column.
    expect(screen.getAllByText('2060')).toHaveLength(2)
    expect(screen.getAllByText('—')).toHaveLength(2) // department + group
  })

  it('renders "—" for a department or group missing on its own', () => {
    // ~2 % of rows carry no department (a role without one) and ~15 % no group
    // — unfilled org structure, not a broken seat.
    renderTable([makeRow({ department: null, group: null })])

    expect(screen.getByText('Іваненко Іван Іванович')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders "—" for an org value that is blank rather than null', () => {
    // The directory concatenates its parts, so an unfilled entry can arrive as
    // whitespace; `?? EMPTY` alone would leave an empty cell instead of "—".
    renderTable([makeRow({ department: '   ', group: '' })])

    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('keys rows by sip+position, so one operator on two seats stays two rows', () => {
    renderTable([
      makeRow({ sip: '2060', full_count: 288 }),
      makeRow({ sip: '2061', full_count: 100 }),
    ])

    expect(screen.getAllByText('Іваненко Іван Іванович')).toHaveLength(2)
    expect(screen.getByText('288')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('renders both rows even if two of them ever share one extension', () => {
    // Not a live contract: the aggregate groups by sip today. The row key
    // carries the position so a contract change cannot collapse two rows into
    // one React key.
    const { container } = renderTable([
      makeRow({ sip: '2060', fio: 'Ярошенко Ярослав', full_count: 288 }),
      makeRow({ sip: '2060', fio: 'Аленко Андрій', full_count: 100 }),
    ])

    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(screen.getByText('Ярошенко Ярослав')).toBeInTheDocument()
    expect(screen.getByText('Аленко Андрій')).toBeInTheDocument()
  })

  it('keeps the server order (full_count DESC) instead of re-sorting', () => {
    const { container } = renderTable([
      makeRow({ sip: '2060', fio: 'Ярошенко Ярослав', full_count: 288 }),
      makeRow({ sip: '2061', fio: 'Аленко Андрій', full_count: 100 }),
    ])

    const names = Array.from(container.querySelectorAll('tbody tr td:first-child')).map(
      (cell) => cell.textContent
    )
    expect(names).toEqual(['Ярошенко Ярослав', 'Аленко Андрій'])
  })

  it('offers no client-side sorting (the order is a contract)', () => {
    renderTable([makeRow()])

    expect(document.querySelectorAll('th.cursor-pointer')).toHaveLength(0)
  })

  it('shows the supplied empty message when the window produced no calls', () => {
    renderTable([], 'pages.reports.outboundCalls.empty')

    expect(screen.getByText('pages.reports.outboundCalls.empty')).toBeInTheDocument()
  })
})

describe('OutboundCallsTable column labels', () => {
  // The component renders KEYS in tests (react-i18next is mocked), so nothing
  // above would notice a key that exists in one locale only. These two check
  // the actual translation files.
  const uk = ukCommon.pages.reports.outboundCalls.columns
  const en = enCommon.pages.reports.outboundCalls.columns

  it('carries exactly one label per rendered column, in both locales', () => {
    expect(Object.keys(uk).sort()).toEqual([...COLUMN_KEYS].sort())
    expect(Object.keys(en).sort()).toEqual([...COLUMN_KEYS].sort())
  })

  it('has as many labels per locale as the table has columns', () => {
    expect(Object.keys(uk)).toHaveLength(OUTBOUND_CALLS_COLUMN_COUNT)
    expect(Object.keys(en)).toHaveLength(OUTBOUND_CALLS_COLUMN_COUNT)
  })
})
