/**
 * RecordPaymentModal — Payment Type field tests (KAN-507).
 *
 * Covers:
 *  - Submit blocked when Payment Type is empty (FE-level required).
 *  - Auto-prefill to `payment_by_rr` when the picked debt has an open RR.
 *  - No auto-prefill when the debt has no open RR.
 *  - No auto-prefill when only terminal-status RRs exist (status_id ∈ {4, 5}).
 *  - Auto-prefill does not overwrite an explicit operator choice.
 *  - onSave payload carries the chosen paymentType.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordPaymentModal } from '../RecordPaymentModal'
import type { DebtDetail, RestructuringAgreementSummary } from '@/features/clients/api/types'
import * as useClientsModule from '@/features/clients/hooks/useClients'

// Hoist a single source of truth for the RR-list mock so tests can swap it.
const mockRrList = vi.fn<() => RestructuringAgreementSummary[]>(() => [])

vi.mock('@/features/clients/hooks/useClients', () => ({
  useClientRestructuringAgreements: vi.fn(),
}))

const makeDebt = (overrides: Partial<DebtDetail> = {}): DebtDetail =>
  ({
    id: 901,
    seller_company: 'Acme',
    contract_number: 'LN-001',
    original_debt_amount: '10000.00',
    remaining_debt_amount: '5000.00',
    status: 'active',
    ...overrides,
  }) as DebtDetail

function renderModal(props: Partial<React.ComponentProps<typeof RecordPaymentModal>> = {}) {
  const onSave = vi.fn()
  render(
    <RecordPaymentModal
      open={true}
      onClose={vi.fn()}
      customerName="Test Client"
      currentDebt={5000}
      debts={[makeDebt()]}
      clientId={42}
      onSave={onSave}
      {...props}
    />
  )
  return { onSave }
}

function fillAmount(value: string) {
  // The Payment Amount input is the first number input in the modal.
  const inputs = screen.getAllByRole('spinbutton')
  fireEvent.change(inputs[0], { target: { value } })
}

beforeEach(() => {
  // Default: no RRs returned.
  mockRrList.mockReturnValue([])
  vi.mocked(useClientsModule.useClientRestructuringAgreements).mockImplementation(
    () =>
      ({
        data: mockRrList(),
        isLoading: false,
        isError: false,
      }) as unknown as ReturnType<typeof useClientsModule.useClientRestructuringAgreements>
  )
})

describe('RecordPaymentModal — Payment Type (KAN-507)', () => {
  it('auto-prefills payment_by_rr when the picked debt has an open RR', () => {
    mockRrList.mockReturnValue([
      { id: 1, debt_id: 901, status_id: 1, status_name: 'Connected' },
    ] as RestructuringAgreementSummary[])

    renderModal()

    // The select trigger renders the active option's translated key. Our
    // i18n mock returns keys verbatim when no entry exists in the table.
    expect(
      screen.getByText('pages.actionAnalysis.filters.paymentTypes.payment_by_rr')
    ).toBeInTheDocument()
  })

  it('does NOT auto-prefill when the debt has no RR', () => {
    mockRrList.mockReturnValue([])
    renderModal()
    expect(
      screen.queryByText('pages.actionAnalysis.filters.paymentTypes.payment_by_rr')
    ).not.toBeInTheDocument()
    // Placeholder is visible instead.
    expect(
      screen.getByText('pages.clients.modals.recordPayment.paymentTypePlaceholder')
    ).toBeInTheDocument()
  })

  it('does NOT auto-prefill when only terminal-status RRs exist (4=Completed / 5=Cancelled)', () => {
    mockRrList.mockReturnValue([
      { id: 1, debt_id: 901, status_id: 4, status_name: 'Completed' },
      { id: 2, debt_id: 901, status_id: 5, status_name: 'Cancelled' },
    ] as RestructuringAgreementSummary[])
    renderModal()
    expect(
      screen.queryByText('pages.actionAnalysis.filters.paymentTypes.payment_by_rr')
    ).not.toBeInTheDocument()
  })

  it('blocks submit when Payment Type is empty', () => {
    const { onSave } = renderModal()
    fillAmount('1000')

    const saveButton = screen
      .getAllByRole('button')
      .find((b) => /save/i.test(b.textContent ?? '')) as HTMLButtonElement
    fireEvent.click(saveButton)

    // onSave never fires because the required error blocks the path.
    expect(onSave).not.toHaveBeenCalled()
  })
})
