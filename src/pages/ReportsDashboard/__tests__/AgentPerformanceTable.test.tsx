/**
 * AgentPerformanceTable — board #1334 (D10: weighted totals) and #1337 (D13:
 * filters that do nothing).
 *
 * react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AgentPerformanceTable, type AgentPerformance } from '../components/AgentPerformanceTable'

function row(
  overrides: Partial<AgentPerformance> & Pick<AgentPerformance, 'id'>
): AgentPerformance {
  return {
    operator: `Operator ${overrides.id}`,
    calls: 0,
    contactRate: 0,
    avgDuration: '00:00',
    sms: 0,
    messages: 0,
    payments: 0,
    ...overrides,
  }
}

function renderTable(data: AgentPerformance[], fromDate = '2026-09-21', toDate = '2026-09-21') {
  return render(
    <AgentPerformanceTable
      data={data}
      selectedPeriod="today"
      selectedOperator={null}
      onOperatorChange={vi.fn()}
      fromDate={fromDate}
      toDate={toDate}
    />
  )
}

/** Cells of the «Всього» row, in column order. */
function totalsCells(): string[] {
  const label = screen.getByText('pages.reports.tableHeaders.total')
  const totalsRow = label.closest('tr')
  if (!totalsRow) throw new Error('totals row not found')
  return within(totalsRow)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '')
}

describe('AgentPerformanceTable totals (D10 #1334)', () => {
  it('weights «Контактність» by calls: rows with 0 calls do not drag it down', () => {
    renderTable([
      row({
        id: '1',
        calls: 100,
        callsAnswered: 20,
        contactRate: 20,
        avgDuration: '1:40',
        totalTalkTime: 2000,
      }),
      // Admin / analyst rows with no calls — they used to add 0 % to a plain mean.
      row({ id: '2', calls: 0, callsAnswered: 0, totalTalkTime: 0 }),
      row({ id: '3', calls: 0, callsAnswered: 0, totalTalkTime: 0 }),
    ])

    const [, calls, rate, avgDuration] = totalsCells()
    expect(calls).toBe('100')
    // Plain mean was (20 + 0 + 0) / 3 ≈ 7 %.
    expect(rate).toBe('20%')
    // Mean of averages was (100 + 0 + 0) / 3 ≈ 0:33; weighted is 2000 / 20.
    expect(avgDuration).toBe('1:40')
  })

  it('weights the average duration by answered calls', () => {
    renderTable([
      row({
        id: '1',
        calls: 50,
        callsAnswered: 10,
        contactRate: 20,
        avgDuration: '1:40',
        totalTalkTime: 1000,
      }),
      row({
        id: '2',
        calls: 150,
        callsAnswered: 90,
        contactRate: 60,
        avgDuration: '0:20',
        totalTalkTime: 1800,
      }),
    ])

    const [, calls, rate, avgDuration] = totalsCells()
    expect(calls).toBe('200')
    expect(rate).toBe('50%')
    expect(avgDuration).toBe('0:28')
  })

  it('falls back to calls × rate when the rows carry no answered counts', () => {
    renderTable([
      row({ id: '1', calls: 200, contactRate: 25, avgDuration: '1:00' }),
      row({ id: '2', calls: 100, contactRate: 50, avgDuration: '0:30' }),
    ])

    const [, , rate, avgDuration] = totalsCells()
    expect(rate).toBe('33.3%')
    expect(avgDuration).toBe('0:45')
  })
})

describe('AgentPerformanceTable filters (D13 #1337)', () => {
  it('has no client phone filter (it never filtered anything)', () => {
    renderTable([row({ id: '1', calls: 5 })])

    expect(screen.queryByText('pages.reports.filters.clientPhone')).not.toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('pages.reports.filters.typePhoneNumber')
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('marks no filter as required', () => {
    renderTable([row({ id: '1', calls: 5 })])

    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('keeps the operator filter', () => {
    renderTable([row({ id: '1', calls: 5 })])

    expect(screen.getByText('pages.reports.filters.responsibleOperator')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'responsible-operator')
  })

  it('shows the queried window as a read-only «Період» instead of disabled date pickers', () => {
    renderTable([row({ id: '1', calls: 5 })], '2026-09-21', '2026-09-27')

    expect(screen.queryByText('pages.reports.filters.dateOfSale')).not.toBeInTheDocument()
    expect(screen.getByText('pages.reports.filters.period')).toBeInTheDocument()
    expect(screen.getByTestId('agent-performance-period')).toHaveTextContent(
      '21-09-2026 – 27-09-2026'
    )
    // Read-only means no input the user could try to type a date into.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows a single date for a one-day window', () => {
    renderTable([row({ id: '1', calls: 5 })], '2026-09-21', '2026-09-21')

    expect(screen.getByTestId('agent-performance-period')).toHaveTextContent(/^21-09-2026$/)
  })
})
