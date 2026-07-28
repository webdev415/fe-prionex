/**
 * LoanCalculationModal tests (KAN-335).
 *
 * Verifies the detailed-calculation modal renders the 19-column table with
 * grouped headers, a sticky Date column, the dynamic title, and the row data.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { LoanCalculationModal } from '../LoanCalculationModal'
import * as useClientsModule from '@/features/clients/hooks/useClients'
import type { LoanCalculationRow } from '@/features/clients/api/types'

vi.mock('@/features/clients/hooks/useClients')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) => {
      let out = fallback || key
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v))
        }
      }
      return out
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const mockUseLoanCalculation = vi.spyOn(useClientsModule, 'useLoanCalculation')

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function makeRow(overrides: Partial<LoanCalculationRow>): LoanCalculationRow {
  return {
    date: '2025-01-10',
    is_sale_row: false,
    principal_debt: '0.00',
    principal_written_off: '0.00',
    principal_paid: '0.00',
    interest_debt: '0.00',
    interest_written_off: '0.00',
    interest_paid: '0.00',
    fine_debt: '0.00',
    fine_written_off: '0.00',
    fine_paid: '0.00',
    penalty_debt: '0.00',
    penalty_written_off: '0.00',
    penalty_paid: '0.00',
    commission_debt: '0.00',
    commission_written_off: '0.00',
    commission_paid: '0.00',
    total_paid: '0.00',
    tot_to_return: '0.00',
    ...overrides,
  }
}

const DATA = {
  loan_id: 42,
  contract_number: 'LOAN-1',
  principal_amount: '10000.00',
  date_of_sale: '2025-01-10',
  currency: 'UAH',
  rows: [
    makeRow({
      date: '2025-01-10',
      is_sale_row: true,
      principal_debt: '10000.00',
      interest_debt: '3000.00',
      tot_to_return: '13000.00',
    }),
    makeRow({
      date: '2025-02-10',
      principal_debt: '9000.00',
      principal_paid: '1000.00',
      interest_debt: '3000.00',
      total_paid: '1000.00',
      tot_to_return: '12000.00',
    }),
  ],
}

function setHook(value: object) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseLoanCalculation.mockReturnValue(value as any)
}

const baseProps = { open: true, onClose: vi.fn(), clientId: 1, debtId: 42, loanNumber: 'LOAN-1' }

describe('LoanCalculationModal', () => {
  it('renders the dynamic title with the loan number', () => {
    setHook({ data: DATA, isLoading: false, isError: false })
    renderWithClient(<LoanCalculationModal {...baseProps} />)
    expect(
      screen.getByText('Detailed calculation for loan No. LOAN-1 after sale')
    ).toBeInTheDocument()
  })

  it('renders all five accrual block headers plus totals', () => {
    setHook({ data: DATA, isLoading: false, isError: false })
    renderWithClient(<LoanCalculationModal {...baseProps} />)
    for (const label of ['Principal', 'Interest', 'Fine', 'Penalty', 'Commissions']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('Total paid')).toBeInTheDocument()
    expect(screen.getByText('Tot to return')).toBeInTheDocument()
    // Sub-headers appear once per block (5x each).
    expect(screen.getAllByText('Debt')).toHaveLength(5)
    expect(screen.getAllByText('Written-off')).toHaveLength(5)
    expect(screen.getAllByText('Paid')).toHaveLength(5)
  })

  it('renders one row per event date with a sticky Date cell', () => {
    setHook({ data: DATA, isLoading: false, isError: false })
    // Radix Dialog renders into a portal on document.body, not `container`.
    renderWithClient(<LoanCalculationModal {...baseProps} />)
    const body = document.querySelector('tbody')!
    const rows = within(body).getAllByRole('row')
    expect(rows).toHaveLength(2)
    // First body cell of each row is the sticky Date column.
    const firstCell = rows[0].querySelector('td')!
    expect(firstCell.className).toContain('sticky')
    expect(firstCell.className).toContain('left-0')
  })

  it('shows the empty state when there are no rows', () => {
    setHook({ data: { ...DATA, rows: [] }, isLoading: false, isError: false })
    renderWithClient(<LoanCalculationModal {...baseProps} />)
    expect(screen.getByText('No balance changes recorded for this loan.')).toBeInTheDocument()
  })

  it('shows the error state on failure', () => {
    setHook({ data: undefined, isLoading: false, isError: true })
    renderWithClient(<LoanCalculationModal {...baseProps} />)
    expect(
      screen.getByText('Could not load the calculation. Please try again.')
    ).toBeInTheDocument()
  })

  it('does not render the table while loading', () => {
    setHook({ data: undefined, isLoading: true, isError: false })
    renderWithClient(<LoanCalculationModal {...baseProps} />)
    expect(document.querySelector('tbody')).toBeNull()
  })
})
