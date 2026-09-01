import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerificationTable } from '../VerificationTable'
import type { ThirdPartyVerificationRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key,
// and i18n.language is 'en' (→ en-US number formatting).

function makeRow(overrides: Partial<ThirdPartyVerificationRow> = {}): ThirdPartyVerificationRow {
  return {
    user_id: 1,
    full_name: 'Іваненко Іван',
    group_name: 'Група 1',
    numbers_added: 900,
    unique_clients: 300,
    month_plan: 1198.8,
    month_plan_diff: -298.8,
    ...overrides,
  }
}

describe('VerificationTable', () => {
  it('renders a row per operator with all six columns', () => {
    render(
      <VerificationTable
        rows={[makeRow(), makeRow({ user_id: 2, full_name: 'Петренко Петро', numbers_added: 400 })]}
      />
    )

    expect(screen.getByText('Іваненко Іван')).toBeInTheDocument()
    expect(screen.getByText('Петренко Петро')).toBeInTheDocument()
    expect(screen.getAllByText('Група 1')).toHaveLength(2)
    expect(screen.getByText('pages.reports.verification.columns.employee')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.verification.columns.numbersAdded')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.verification.columns.uniqueClients')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.verification.columns.monthPlan')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.verification.columns.monthPlanDiff')).toBeInTheDocument()
  })

  it('keeps the fractional plan instead of truncating it (contract differs from TF)', () => {
    render(<VerificationTable rows={[makeRow({ month_plan: 1198.8, month_plan_diff: -298.8 })]} />)

    // Techno-Finance pushed both through `_to_int` and showed 1198 — this API
    // returns exact decimals and the table must not round them away.
    expect(screen.getByText('1,198.8')).toBeInTheDocument()
    expect(screen.getByText('-298.8')).toBeInTheDocument()
  })

  it('accepts a Decimal serialised as a JSON string', () => {
    render(
      <VerificationTable rows={[makeRow({ month_plan: '1198.8', month_plan_diff: '-298.8' })]} />
    )

    expect(screen.getByText('1,198.8')).toBeInTheDocument()
    expect(screen.getByText('-298.8')).toBeInTheDocument()
  })

  it('renders "—" for a null plan and shortfall, with no colour', () => {
    render(<VerificationTable rows={[makeRow({ month_plan: null, month_plan_diff: null })]} />)

    const placeholders = screen.getAllByText('—')
    expect(placeholders.length).toBeGreaterThanOrEqual(2)
    placeholders.forEach((node) => {
      expect(node.className).not.toContain('text-error-500')
      expect(node.className).not.toContain('text-success-500')
    })
  })

  it('fills the two gradient columns and leaves the plan/shortfall columns unfilled', () => {
    render(
      <VerificationTable
        rows={[
          makeRow({ user_id: 1, numbers_added: 1200, unique_clients: 400 }),
          makeRow({
            user_id: 2,
            full_name: 'Петренко Петро',
            numbers_added: 10,
            unique_clients: 5,
          }),
        ]}
      />
    )

    const high = screen.getByText('1,200')
    const low = screen.getByText('10')
    expect(high.style.backgroundColor).not.toBe('')
    expect(low.style.backgroundColor).not.toBe('')
    // Scale is [0 .. max(month_plan)] — a higher fact must not share the
    // colour of a near-zero one.
    expect(high.style.backgroundColor).not.toBe(low.style.backgroundColor)

    // Unique clients use the column's own [min .. max]
    expect(screen.getByText('400').style.backgroundColor).not.toBe(
      screen.getByText('5').style.backgroundColor
    )

    // «Недостача до плану» is text colour only — never a fill
    screen.getAllByText('-298.8').forEach((cell) => expect(cell.style.backgroundColor).toBe(''))
  })

  it('colours the shortfall red when negative and green when zero or positive', () => {
    render(
      <VerificationTable
        rows={[
          makeRow({ user_id: 1, month_plan_diff: -5 }),
          makeRow({ user_id: 2, full_name: 'Нульовенко', month_plan_diff: 0 }),
          makeRow({ user_id: 3, full_name: 'Перевиконенко', month_plan_diff: 7 }),
        ]}
      />
    )

    expect(screen.getByText('-5').className).toContain('text-error-500')
    expect(screen.getByText('0').className).toContain('text-success-500')
    expect(screen.getByText('7').className).toContain('text-success-500')
  })

  it('survives undefined numerics in a malformed payload', () => {
    // A missing counter must degrade to "—" (never "NaN", never a crash that
    // takes the whole tab down).
    const broken = {
      user_id: 9,
      full_name: 'Поламанко',
      group_name: null,
    } as unknown as ThirdPartyVerificationRow

    render(<VerificationTable rows={[broken]} />)

    expect(screen.getByText('Поламанко')).toBeInTheDocument()
    expect(screen.queryByText('NaN')).not.toBeInTheDocument()
    // group + 4 numeric columns all fall back to the placeholder
    expect(screen.getAllByText('—')).toHaveLength(5)
  })

  it('shows the empty state when there are no rows', () => {
    render(<VerificationTable rows={[]} />)

    expect(screen.getByText('pages.reports.verification.empty')).toBeInTheDocument()
  })
})
