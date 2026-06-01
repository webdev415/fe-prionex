/** RR status_id taxonomy mirrored from rr_status_service.py:
 *   1 = CONNECTED, 2 = VIOLATED, 3 = CANCELLED, 4 = COMPLETED, 5 = COMPLETED_EARLY.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordPaymentModal } from '../RecordPaymentModal'
import type { DebtDetail, RestructuringAgreementSummary } from '@/features/clients/api/types'
import * as useClientsModule from '@/features/clients/hooks/useClients'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'

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

describe('RecordPaymentModal — credit dropdown label', () => {
  it('shows credit number, counterparty name, and total debt separated by dots', () => {
    renderModal({
      debts: [
        makeDebt({
          id: 1,
          contract_number: 'LN-001',
          seller_company: 'Acme Bank',
          remaining_debt_amount: '5000.00',
        }),
        makeDebt({
          id: 2,
          contract_number: 'LN-002',
          seller_company: 'Beta LLC',
          remaining_debt_amount: '1200.50',
        }),
      ],
    })

    const contractSelect = screen.getAllByRole('combobox')[0]
    fireEvent.click(contractSelect)

    const label1 = `LN-001 • Acme Bank • ${formatMoneyUAHTwoDecimals('5000.00')}`
    const label2 = `LN-002 • Beta LLC • ${formatMoneyUAHTwoDecimals('1200.50')}`
    expect(screen.getAllByText(label1).length).toBeGreaterThan(0)
    expect(screen.getByText(label2)).toBeInTheDocument()
  })
})

describe('RecordPaymentModal — Payment Type (KAN-507)', () => {
  it('auto-prefills payment_by_rr when the picked debt has a Connected RR', () => {
    mockRrList.mockReturnValue([
      { id: 1, debt_id: 901, status_id: 1, status_name: 'Connected' },
    ] as RestructuringAgreementSummary[])

    renderModal()

    // The select trigger renders the active option's translated key. Our
    // i18n mock returns keys verbatim when no entry exists in the table.
    expect(
      screen.getByText('pages.training.filters.paymentTypes.payment_by_rr')
    ).toBeInTheDocument()
  })

  it('does NOT auto-prefill when the debt has no RR', () => {
    mockRrList.mockReturnValue([])
    renderModal()
    expect(
      screen.queryByText('pages.training.filters.paymentTypes.payment_by_rr')
    ).not.toBeInTheDocument()
    // Placeholder is visible instead.
    expect(
      screen.getByText('pages.clients.modals.recordPayment.paymentTypePlaceholder')
    ).toBeInTheDocument()
  })

  it.each([
    [2, 'Violated'],
    [3, 'Cancelled'],
    [4, 'Completed'],
    [5, 'CompletedEarly'],
  ])(
    'does NOT auto-prefill when the only RR has non-Connected status_id=%s (%s)',
    (statusId, statusName) => {
      mockRrList.mockReturnValue([
        { id: 1, debt_id: 901, status_id: statusId, status_name: statusName },
      ] as RestructuringAgreementSummary[])
      renderModal()
      expect(
        screen.queryByText('pages.training.filters.paymentTypes.payment_by_rr')
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('pages.clients.modals.recordPayment.paymentTypePlaceholder')
      ).toBeInTheDocument()
    }
  )

  it('omits "Payment by RR" from the dropdown when no Connected RR exists', () => {
    mockRrList.mockReturnValue([])
    renderModal()

    const trigger = screen.getByLabelText(
      'pages.clients.modals.recordPayment.paymentTypeLabel'
    ) as HTMLElement
    fireEvent.click(trigger)

    // Partial + Full are available; Payment by RR is not.
    expect(
      screen.getByText('pages.training.filters.paymentTypes.partial_payment')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.training.filters.paymentTypes.full_payment')).toBeInTheDocument()
    expect(
      screen.queryByText('pages.training.filters.paymentTypes.payment_by_rr')
    ).not.toBeInTheDocument()
  })

  it('shows "Payment by RR" in the dropdown when a Connected RR exists', () => {
    mockRrList.mockReturnValue([
      { id: 1, debt_id: 901, status_id: 1, status_name: 'Connected' },
    ] as RestructuringAgreementSummary[])
    renderModal()

    const trigger = screen.getByLabelText(
      'pages.clients.modals.recordPayment.paymentTypeLabel'
    ) as HTMLElement
    fireEvent.click(trigger)

    // payment_by_rr appears both on the trigger (active value) and in the
    // listbox, so assert > 0 occurrences rather than an exact instance.
    expect(
      screen.getAllByText('pages.training.filters.paymentTypes.payment_by_rr').length
    ).toBeGreaterThan(0)
    expect(
      screen.getByText('pages.training.filters.paymentTypes.partial_payment')
    ).toBeInTheDocument()
    expect(screen.getByText('pages.training.filters.paymentTypes.full_payment')).toBeInTheDocument()
  })

  it('clears a stale payment_by_rr when the picked debt loses its Connected RR', () => {
    mockRrList.mockReturnValue([
      { id: 1, debt_id: 901, status_id: 1, status_name: 'Connected' },
    ] as RestructuringAgreementSummary[])
    const { rerender } = render(
      <RecordPaymentModal
        open={true}
        onClose={vi.fn()}
        customerName="Test Client"
        currentDebt={5000}
        debts={[makeDebt()]}
        clientId={42}
        onSave={vi.fn()}
      />
    )
    expect(
      screen.getByText('pages.training.filters.paymentTypes.payment_by_rr')
    ).toBeInTheDocument()

    // RR list now reports the same debt with status_id=2 (Violated).
    mockRrList.mockReturnValue([
      { id: 1, debt_id: 901, status_id: 2, status_name: 'Violated' },
    ] as RestructuringAgreementSummary[])
    rerender(
      <RecordPaymentModal
        open={true}
        onClose={vi.fn()}
        customerName="Test Client"
        currentDebt={5000}
        debts={[makeDebt()]}
        clientId={42}
        onSave={vi.fn()}
      />
    )

    expect(
      screen.queryByText('pages.training.filters.paymentTypes.payment_by_rr')
    ).not.toBeInTheDocument()
    // Placeholder is back â€” the operator must re-pick a valid option.
    expect(
      screen.getByText('pages.clients.modals.recordPayment.paymentTypePlaceholder')
    ).toBeInTheDocument()
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
