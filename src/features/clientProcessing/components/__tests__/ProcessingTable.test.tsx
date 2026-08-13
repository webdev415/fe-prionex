import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProcessingTable } from '../ProcessingTable'
import type { ProcessingReportRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

function makeRow(overrides: Partial<ProcessingReportRow> = {}): ProcessingReportRow {
  return {
    employee_id: 1,
    full_name: 'Іваненко Іван',
    department_id: 10,
    department_name: 'ТП',
    group_id: 100,
    group_name: 'Група 1',
    count_client: 200,
    count_processed: 120,
    count_processed_client: 90,
    count_processed_contact: 40,
    percent_processed: 60,
    percent_processed_client: 45,
    percent_processed_contact: 20,
    ...overrides,
  }
}

describe('ProcessingTable', () => {
  it('renders a row per employee with counts and XX.XX% percents', () => {
    render(
      <ProcessingTable
        rows={[
          makeRow(),
          makeRow({ employee_id: 2, full_name: 'Петренко Петро', percent_processed: 76.6 }),
        ]}
      />
    )

    expect(screen.getByText('Іваненко Іван')).toBeInTheDocument()
    expect(screen.getByText('Петренко Петро')).toBeInTheDocument()
    expect(screen.getAllByText('Група 1')).toHaveLength(2)
    // Percents arrive on the 0..100 scale and render without ×100
    expect(screen.getByText('60.00%')).toBeInTheDocument()
    expect(screen.getByText('76.60%')).toBeInTheDocument()
    expect(screen.getAllByText('45.00%')).toHaveLength(2)
    // 9 header columns, three of them visually just "%"
    expect(screen.getAllByText('pages.reports.processing.columns.percent')).toHaveLength(3)
    expect(screen.getByText('pages.reports.processing.columns.employee')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.processing.columns.assignedClients')).toBeInTheDocument()
  })

  it('gives the three "%" columns distinct accessible names', () => {
    render(<ProcessingTable rows={[makeRow()]} />)

    // The visible "%" is aria-hidden and the sr-only span carries the name —
    // dropping either would collapse all three into the same "%" for screen
    // readers, so assert the computed names, not just the text.
    expect(
      screen.getByRole('columnheader', {
        name: 'pages.reports.processing.columns.percentProcessedAria',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', {
        name: 'pages.reports.processing.columns.percentClientAria',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', {
        name: 'pages.reports.processing.columns.percentContactAria',
      })
    ).toBeInTheDocument()
    // …and none of them is named by the visible "%" alone
    expect(
      screen.queryByRole('columnheader', { name: 'pages.reports.processing.columns.percent' })
    ).not.toBeInTheDocument()
  })

  it('applies a gradient fill to percent cells but not to null cells', () => {
    render(
      <ProcessingTable
        rows={[
          makeRow({
            percent_processed: 100,
            percent_processed_client: null,
            percent_processed_contact: 0,
          }),
        ]}
      />
    )

    const greenCell = screen.getByText('100.00%')
    const redCell = screen.getByText('0.00%')
    const nullCell = screen.getByText('—')

    expect(greenCell.style.backgroundColor).not.toBe('')
    expect(redCell.style.backgroundColor).not.toBe('')
    expect(greenCell.style.backgroundColor).not.toBe(redCell.style.backgroundColor)
    expect(nullCell.style.backgroundColor).toBe('')
  })

  it('shows the empty state when there are no rows', () => {
    render(<ProcessingTable rows={[]} />)

    expect(screen.getByText('pages.reports.processing.empty')).toBeInTheDocument()
  })
})
