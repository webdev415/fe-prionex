import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OPERATOR_PROMISES_COLUMN_COUNT, OperatorPromisesTable } from '../OperatorPromisesTable'
import type { OperatorPromisesRow } from '../../types'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key
// and i18n.language is 'en'. formatNumber (@/lib/localeFormat) is real, so the
// number rendering below exercises the actual Intl path, not a stub.

function makeRow(overrides: Partial<OperatorPromisesRow> = {}): OperatorPromisesRow {
  return {
    user_id: 101,
    fio: 'Баженов Олексій Володимирович',
    department: 'Стягнення',
    department_id: 3,
    group_name: 'Група №2',
    is_active: true,
    interactions_count: 314,
    sum_from: '112062.00',
    sum_to: '24000.00',
    paid_full: '31400.00',
    // Deliberately BELOW paid_full: the verified trio must be assertable on its
    // own, and `paid_verified <= paid_full` is a contract invariant.
    paid_verified: '20000.00',
    unpaid: '-7400.00',
    conversion: '1.308333',
    verified_unpaid: '4000.00',
    verified_conversion: '0.833333',
    ...overrides,
  }
}

function renderTable(rows: OperatorPromisesRow[], emptyMessage = 'empty') {
  return render(<OperatorPromisesTable rows={rows} emptyMessage={emptyMessage} />)
}

/**
 * The twelve columns IN RENDER ORDER — the directory block, then the money
 * window, then TF's two payment trios: paid / unpaid / conversion over all
 * payments, then the same three over the verified subset (decision
 * 2026-08-19). The order is asserted below, not just the membership: reading a
 * verified figure as a full-payment one is a silent misread of money, and the
 * totals block lists the same metrics in the same sequence.
 */
const COLUMN_KEYS = [
  'operator',
  'department',
  'group',
  'interactions',
  'sumFrom',
  'sumTo',
  'paidFull',
  'unpaid',
  'conversion',
  'paidVerified',
  'unpaidVerified',
  'conversionVerified',
]

const COLUMN_LABEL_KEYS = COLUMN_KEYS.map((key) => `pages.reports.operatorPromises.columns.${key}`)

describe('OperatorPromisesTable', () => {
  it('renders all twelve columns of the contract', () => {
    renderTable([makeRow()])

    for (const key of COLUMN_KEYS) {
      expect(screen.getByText(`pages.reports.operatorPromises.columns.${key}`)).toBeInTheDocument()
    }
  })

  it('renders the twelve headers in the contract SEQUENCE, verified trio last', () => {
    // Membership (the test above) would pass with the trios interleaved: a
    // reader scanning left to right would then take a verified figure for the
    // full-payment one. The sequence is the contract — full trio first, then
    // the verified trio — so it is asserted position by position.
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(
      COLUMN_LABEL_KEYS
    )
  })

  it('renders exactly as many headers as the exported column count promises', () => {
    // The skeleton of this table is sized from OPERATOR_PROMISES_COLUMN_COUNT
    // while the columns themselves are built inside the component (they need
    // `t`), so this is what catches the two drifting apart.
    renderTable([makeRow()])

    expect(screen.getAllByRole('columnheader')).toHaveLength(OPERATOR_PROMISES_COLUMN_COUNT)
  })

  it('renders one row per operator with the directory labels', () => {
    renderTable([makeRow(), makeRow({ user_id: 118, fio: 'Петренко Петро' })])

    expect(screen.getByText('Баженов Олексій Володимирович')).toBeInTheDocument()
    expect(screen.getByText('Петренко Петро')).toBeInTheDocument()
    expect(screen.getAllByText('Стягнення')).toHaveLength(2)
    expect(screen.getAllByText('Група №2')).toHaveLength(2)
  })

  it('keys rows by user_id, so two namesakes stay two rows', () => {
    // The card's GROUP BY on the concatenated ФИО merges the 6 colliding active
    // accounts into one; this report shows both.
    renderTable([
      makeRow({ user_id: 1, fio: 'Іваненко Іван Іванович', interactions_count: 10 }),
      makeRow({ user_id: 2, fio: 'Іваненко Іван Іванович', interactions_count: 20 }),
    ])

    expect(screen.getAllByText('Іваненко Іван Іванович')).toHaveLength(2)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('renders the Decimal-as-string money columns with two decimals', () => {
    renderTable([makeRow()])

    expect(screen.getByText('112,062.00')).toBeInTheDocument() // sum_from
    expect(screen.getByText('24,000.00')).toBeInTheDocument() // sum_to
    expect(screen.getByText('31,400.00')).toBeInTheDocument() // paid_full
    expect(screen.getByText('20,000.00')).toBeInTheDocument() // paid_verified
  })

  it('renders the verified twins from the payload, never derived on the client', () => {
    // `verified_unpaid` = sum_to − paid_verified and `verified_conversion` =
    // paid_verified / sum_to arrive computed (backend contract of 2026-08-19,
    // full column parity with Techno-Finance) — the table only formats them.
    renderTable([makeRow()])

    expect(screen.getByText('4,000.00')).toBeInTheDocument() // verified_unpaid
    expect(screen.getByText('83.33%')).toBeInTheDocument() // verified_conversion
  })

  it('shows a NEGATIVE verified_unpaid rather than clamping it at zero', () => {
    // Rarer than a negative `unpaid` (paid_verified <= paid_full), but a
    // verified overpayment is a real row and its sign is the signal.
    renderTable([makeRow({ paid_verified: '31400.00', verified_unpaid: '-7400.00' })])

    expect(screen.getAllByText('-7,400.00')).toHaveLength(2) // unpaid + its twin
  })

  it('renders "—" for a null verified_conversion, and only for that column', () => {
    renderTable([makeRow({ verified_conversion: null })])

    expect(screen.getAllByText('—')).toHaveLength(1)
    // …while the full-payment conversion of the same row still renders.
    expect(screen.getByText('130.83%')).toBeInTheDocument()
  })

  it('shows a negative unpaid value as an overpayment rather than hiding it', () => {
    // `unpaid` = sum_to − paid_full: negative means the operator collected more
    // than was due in the window, which is normal here because payments are
    // never matched to the promises they settle.
    renderTable([makeRow()])

    expect(screen.getByText('-7,400.00')).toBeInTheDocument()
  })

  it('renders the conversion SHARE as a percentage', () => {
    renderTable([makeRow()])

    expect(screen.getByText('130.83%')).toBeInTheDocument()
  })

  it('renders a conversion above 100 % unclamped', () => {
    // Production maximum for July 2026 is 8.15.
    renderTable([makeRow({ conversion: '8.15' })])

    expect(screen.getByText('815.00%')).toBeInTheDocument()
  })

  it('renders "—" for a null conversion (nothing was due)', () => {
    renderTable([makeRow({ conversion: null, sum_to: '0.00' })])

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders "—" for every nullable directory column', () => {
    // A department-less operator keeps their row — the report has no department
    // filter and such rows carry real money.
    // `department_id` is null alongside the name, as the contract pairs them.
    renderTable([makeRow({ fio: null, department: null, department_id: null, group_name: null })])

    expect(screen.getAllByText('—')).toHaveLength(3)
  })

  it('renders "—" for an unparseable money value instead of "NaN"', () => {
    renderTable([makeRow({ sum_from: 'not-a-number' })])

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders an all-zero "roster" row rather than dropping it', () => {
    // The base query has no date filter, so an operator idle in the period is
    // still listed (13 such rows in the July 2026 sample) — card parity.
    renderTable([
      makeRow({
        interactions_count: 0,
        sum_from: '0.00',
        sum_to: '0.00',
        paid_full: '0.00',
        paid_verified: '0.00',
        unpaid: '0.00',
        conversion: null,
        verified_unpaid: '0.00',
        verified_conversion: null,
      }),
    ])

    expect(screen.getByText('Баженов Олексій Володимирович')).toBeInTheDocument()
    expect(screen.getAllByText('0.00')).toHaveLength(6)
  })

  it('marks a dismissed operator with a TEXT badge, not with colour alone', () => {
    // Colour-only would be invisible to a screen reader and unreliable across
    // the project's themes (docs_local/12-lessons-learned.md).
    renderTable([makeRow({ is_active: false })])

    expect(screen.getByText('pages.reports.operatorPromises.inactiveBadge')).toBeInTheDocument()
  })

  it('dims the dismissed operator’s row with theme-independent opacity', () => {
    const { container } = renderTable([
      makeRow({ user_id: 1, is_active: true }),
      makeRow({ user_id: 2, fio: 'Звільненко Захар', is_active: false }),
    ])

    const bodyRows = container.querySelectorAll('tbody tr')
    expect(bodyRows).toHaveLength(2)
    expect(bodyRows[0].className).not.toContain('opacity-60')
    expect(bodyRows[1].className).toContain('opacity-60')
  })

  it('shows no badge for an active operator', () => {
    renderTable([makeRow({ is_active: true })])

    expect(
      screen.queryByText('pages.reports.operatorPromises.inactiveBadge')
    ).not.toBeInTheDocument()
  })

  it('keeps a dismissed operator in the server’s order, not at the bottom', () => {
    // `is_active` deliberately does not participate in the sort: a dismissed
    // operator stays in their department and group, marked rather than herded.
    const { container } = renderTable([
      makeRow({ user_id: 1, fio: 'Аленко Андрій', is_active: false }),
      makeRow({ user_id: 2, fio: 'Беленко Борис', is_active: true }),
    ])

    const names = Array.from(container.querySelectorAll('tbody tr td:first-child')).map(
      (cell) => cell.textContent
    )
    expect(names[0]).toContain('Аленко Андрій')
    expect(names[1]).toContain('Беленко Борис')
  })

  it('shows the supplied empty message when the department has no rows', () => {
    renderTable([], 'pages.reports.operatorPromises.empty')

    expect(screen.getByText('pages.reports.operatorPromises.empty')).toBeInTheDocument()
  })

  it('offers no client-side sorting (the order is a contract)', () => {
    // department → group_name → fio → user_id, NULLs last — resorting one
    // column would break the grouping the tabs are read through.
    renderTable([makeRow()])

    expect(document.querySelectorAll('th.cursor-pointer')).toHaveLength(0)
  })
})

describe('OperatorPromisesTable column labels', () => {
  // The component renders KEYS in tests (react-i18next is mocked), so nothing
  // above would notice a key that exists in one locale only. These two check
  // the actual translation files.
  const uk = ukCommon.pages.reports.operatorPromises.columns
  const en = enCommon.pages.reports.operatorPromises.columns

  it('carries exactly one label per rendered column, in both locales', () => {
    expect(Object.keys(uk).sort()).toEqual([...COLUMN_KEYS].sort())
    expect(Object.keys(en).sort()).toEqual([...COLUMN_KEYS].sort())
  })

  it('has as many labels per locale as the table has columns', () => {
    expect(Object.keys(uk)).toHaveLength(OPERATOR_PROMISES_COLUMN_COUNT)
    expect(Object.keys(en)).toHaveLength(OPERATOR_PROMISES_COLUMN_COUNT)
  })
})
