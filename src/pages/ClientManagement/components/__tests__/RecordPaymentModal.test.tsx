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
    [3, 'Cancelled'],
    [4, 'Completed'],
    [5, 'CompletedEarly'],
  ])(
    'does NOT auto-prefill when the only RR has ineligible status_id=%s (%s)',
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

  it('clears a stale payment_by_rr when the picked debt loses its eligible RR', () => {
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

    // RR list now reports the same debt with status_id=3 (Cancelled), which
    // has its own reconnect mechanism and is not payable by RR.
    mockRrList.mockReturnValue([
      { id: 1, debt_id: 901, status_id: 3, status_name: 'Cancelled' },
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
    // Placeholder is back — the operator must re-pick a valid option.
    expect(
      screen.getByText('pages.clients.modals.recordPayment.paymentTypePlaceholder')
    ).toBeInTheDocument()
  })

  // KAN-1013. A violated plan is exactly the one that needs a catch-up
  // payment; offering the type only on Connected left it with no way back to
  // Connected, so it just aged into Cancelled.
  it('offers payment_by_rr when the picked debt has a Violated RR', () => {
    mockRrList.mockReturnValue([
      { id: 7, debt_id: 901, status_id: 2, status_name: 'Violated' },
    ] as RestructuringAgreementSummary[])

    renderModal()

    expect(
      screen.getByText('pages.training.filters.paymentTypes.payment_by_rr')
    ).toBeInTheDocument()
  })

  it('submits the violated RR id so the backend can re-evaluate it', () => {
    mockRrList.mockReturnValue([
      { id: 7, debt_id: 901, status_id: 2, status_name: 'Violated' },
    ] as RestructuringAgreementSummary[])
    const { onSave } = renderModal()
    fillAmount('1000')

    const saveButton = screen
      .getAllByRole('button')
      .find((b) => /save/i.test(b.textContent ?? '')) as HTMLButtonElement
    fireEvent.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({
      paymentType: 'payment_by_rr',
      restructuringAgreementId: 7,
    })
  })

  it('keeps a Connected RR winning over a violated one on the same debt', () => {
    mockRrList.mockReturnValue([
      { id: 7, debt_id: 901, status_id: 2, status_name: 'Violated' },
      { id: 8, debt_id: 901, status_id: 1, status_name: 'Connected' },
    ] as RestructuringAgreementSummary[])
    const { onSave } = renderModal()
    fillAmount('1000')

    const saveButton = screen
      .getAllByRole('button')
      .find((b) => /save/i.test(b.textContent ?? '')) as HTMLButtonElement
    fireEvent.click(saveButton)

    expect(onSave.mock.calls[0][0].restructuringAgreementId).toBe(8)
  })

  it('treats an RR with no status as ineligible rather than payable', () => {
    mockRrList.mockReturnValue([
      { id: 9, debt_id: 901, status_id: null, status_name: null },
    ] as RestructuringAgreementSummary[])

    renderModal()

    expect(
      screen.queryByText('pages.training.filters.paymentTypes.payment_by_rr')
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

const K = 'pages.clients.modals.recordPayment'

/** A Connected RR on the default debt, so Payment Type auto-selects and the
 *  save path is reachable — the same setup the RR tests above rely on. */
function withPayableRr() {
  mockRrList.mockReturnValue([
    { id: 8, debt_id: 901, status_id: 1, status_name: 'Connected' },
  ] as RestructuringAgreementSummary[])
}

/** Render with a real close->reopen cycle, so the reset paths actually run. */
function renderModalForReopen(
  props: Partial<React.ComponentProps<typeof RecordPaymentModal>> = {}
) {
  const view = render(
    <RecordPaymentModal
      open={true}
      onClose={vi.fn()}
      customerName="Test Client"
      currentDebt={5000}
      debts={[makeDebt()]}
      clientId={42}
      onSave={vi.fn()}
      {...props}
    />
  )
  const rerender = () =>
    view.rerender(
      <RecordPaymentModal
        open={true}
        onClose={vi.fn()}
        customerName="Test Client"
        currentDebt={5000}
        debts={[makeDebt()]}
        clientId={42}
        onSave={vi.fn()}
        {...props}
      />
    )
  return { rerender }
}

function selectEasyPay() {
  fireEvent.click(screen.getByLabelText(`${K}.easypay`))
}

function clickSaveAsPending() {
  fireEvent.click(screen.getByText(`${K}.saveAsPending`).closest('button') as HTMLButtonElement)
}

function amountInput() {
  return screen.getAllByRole('spinbutton')[0]
}

describe('RecordPaymentModal — EasyPay method', () => {
  it('offers EasyPay in place of the retired Card option', () => {
    renderModal()

    expect(screen.getByLabelText(`${K}.easypay`)).toBeInTheDocument()
    expect(screen.queryByLabelText(`${K}.card`)).not.toBeInTheDocument()
  })

  it('shows the EasyPay method selector only while EasyPay is the payment method', () => {
    renderModal()

    // Absent, not merely disabled, for the other methods.
    expect(screen.queryByLabelText(`${K}.easypayMethods.card`)).not.toBeInTheDocument()

    selectEasyPay()

    expect(screen.getByLabelText(`${K}.easypayMethods.card`)).toBeInTheDocument()
    expect(screen.getByLabelText(`${K}.easypayMethods.google_pay`)).toBeInTheDocument()
    expect(screen.getByLabelText(`${K}.easypayMethods.apple_pay`)).toBeInTheDocument()
  })

  it('sends the chosen EasyPay method', () => {
    withPayableRr()
    const { onSave } = renderModal()

    selectEasyPay()
    fireEvent.click(screen.getByLabelText(`${K}.easypayMethods.google_pay`))
    fillAmount('100')
    clickSaveAsPending()

    expect(onSave.mock.calls[0][0]).toMatchObject({
      method: 'EasyPay',
      easypayMethod: 'google_pay',
    })
  })

  it('leaves easypayMethod undefined for a bank transfer', () => {
    withPayableRr()
    const { onSave } = renderModal()

    fillAmount('100')
    clickSaveAsPending()

    expect(onSave.mock.calls[0][0].method).toBe('Bank Transfer')
    expect(onSave.mock.calls[0][0].easypayMethod).toBeUndefined()
  })
})

describe('RecordPaymentModal — EasyPay amount ceiling', () => {
  it('clips an over-limit amount when the method changes underneath it', () => {
    // 50,000 is valid against a 60,000 debt until EasyPay lowers the ceiling.
    renderModal({
      currentDebt: 60000,
      debts: [makeDebt({ remaining_debt_amount: '60000.00' })],
    })

    fillAmount('50000')
    selectEasyPay()

    expect(amountInput()).toHaveValue(29999)
  })

  it('keeps the debt ceiling when it is below the KYC threshold', () => {
    renderModal({ currentDebt: 5000, debts: [makeDebt({ remaining_debt_amount: '5000.00' })] })

    fillAmount('5000')
    selectEasyPay()

    // 5,000 is under both caps, so nothing is rewritten.
    expect(amountInput()).toHaveValue(5000)
  })

  it('blocks the save rather than rewriting a figure typed over the limit', () => {
    withPayableRr()
    const { onSave } = renderModal({
      currentDebt: 60000,
      debts: [makeDebt({ remaining_debt_amount: '60000.00' })],
    })

    selectEasyPay()
    fillAmount('50000')

    // The operator can see the limit they typed past, so it is an ordinary
    // validation error: the value stands and the save is refused.
    expect(amountInput()).toHaveValue(50000)
    clickSaveAsPending()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('RecordPaymentModal — EasyPay impact preview', () => {
  it('announces the link and offers to copy it, ticked by default', () => {
    withPayableRr()
    const { onSave } = renderModal()

    expect(screen.queryByText(`${K}.easypayLinkWillBeCreated`)).not.toBeInTheDocument()

    selectEasyPay()

    expect(screen.getByText(`${K}.easypayLinkWillBeCreated`)).toBeInTheDocument()
    fillAmount('100')
    clickSaveAsPending()

    expect(onSave.mock.calls[0][0].copyLinkAfterSave).toBe(true)
  })

  it('honours unticking the copy checkbox', () => {
    withPayableRr()
    const { onSave } = renderModal()

    selectEasyPay()
    fireEvent.click(screen.getByText(`${K}.copyLinkAfterSaving`))
    fillAmount('100')
    clickSaveAsPending()

    expect(onSave.mock.calls[0][0].copyLinkAfterSave).toBe(false)
  })

  it('sends no copy instruction for a non-EasyPay payment', () => {
    withPayableRr()
    const { onSave } = renderModal()

    fillAmount('100')
    clickSaveAsPending()

    expect(onSave.mock.calls[0][0].copyLinkAfterSave).toBeUndefined()
  })
})

describe('RecordPaymentModal — Save & Confirm under EasyPay', () => {
  it('disables rather than hides it, so a missing button still means no permission', () => {
    withPayableRr()
    renderModal({ canVerify: true })
    fillAmount('100')

    expect(screen.getByText(`${K}.saveAndVerify`).closest('button')).toBeEnabled()

    selectEasyPay()

    // Nothing is confirmed until the gateway callback arrives.
    expect(screen.getByText(`${K}.saveAndVerify`).closest('button')).toBeDisabled()
  })

  it('still never renders it for a user without the permission', () => {
    withPayableRr()
    renderModal({ canVerify: false })
    fillAmount('100')

    selectEasyPay()

    expect(screen.queryByText(`${K}.saveAndVerify`)).not.toBeInTheDocument()
  })
})

describe('RecordPaymentModal — the EasyPay fields reset with the rest of the form', () => {
  it('reopens with the copy box ticked and the EasyPay method back to card', () => {
    withPayableRr()
    const onClose = vi.fn()
    const { rerender } = renderModalForReopen({ onClose })

    selectEasyPay()
    fireEvent.click(screen.getByLabelText(`${K}.easypayMethods.apple_pay`))
    fireEvent.click(screen.getByText(`${K}.copyLinkAfterSaving`))
    fireEvent.click(screen.getByText(`${K}.cancel`).closest('button') as HTMLButtonElement)

    // Reopen: every other field resets here, and these must not be the
    // exception -- "ticked by default" has to survive the operator's last use.
    rerender()
    selectEasyPay()

    expect(screen.getByLabelText(`${K}.easypayMethods.card`)).toBeChecked()
    expect(screen.getByLabelText(`${K}.easypayMethods.apple_pay`)).not.toBeChecked()
    const checkbox = screen
      .getByText(`${K}.copyLinkAfterSaving`)
      .closest('label')
      ?.querySelector('[role="checkbox"]')
    expect(checkbox).toHaveAttribute('data-state', 'checked')
  })
})

describe('RecordPaymentModal — switching to EasyPay only clips the ceiling that appeared', () => {
  it('caps an over-cap amount and says so', () => {
    // 50,000 is valid against a 60,000 debt until EasyPay lowers the ceiling
    // to the KYC threshold without the operator touching the field.
    renderModal({ currentDebt: 60000, debts: [makeDebt({ remaining_debt_amount: '60000.00' })] })

    fillAmount('50000')
    selectEasyPay()

    expect(amountInput()).toHaveValue(29999)
    expect(screen.getByText(`${K}.amountCappedToEasypayLimit`)).toBeInTheDocument()
  })

  it('leaves an over-debt amount alone, error and all', () => {
    // The debt ceiling was already visible and already showing an error. It is
    // theirs to correct: rewriting it would change a monetary figure silently
    // and clear the warning that explained why it was wrong.
    renderModal({ currentDebt: 5000, debts: [makeDebt({ remaining_debt_amount: '5000.00' })] })

    fillAmount('9000')
    selectEasyPay()

    expect(amountInput()).toHaveValue(9000)
    expect(screen.queryByText(`${K}.amountCappedToEasypayLimit`)).not.toBeInTheDocument()
  })

  it('clears the notice once the operator types again', () => {
    renderModal({ currentDebt: 60000, debts: [makeDebt({ remaining_debt_amount: '60000.00' })] })

    fillAmount('50000')
    selectEasyPay()
    expect(screen.getByText(`${K}.amountCappedToEasypayLimit`)).toBeInTheDocument()

    fillAmount('100')
    expect(screen.queryByText(`${K}.amountCappedToEasypayLimit`)).not.toBeInTheDocument()
  })
})

describe('RecordPaymentModal — exceeding the EasyPay cap explains itself', () => {
  it('shows an error rather than only disabling Save', () => {
    // maxAmount fed hasValidationErrors but nothing ever set an error for it,
    // so an over-cap amount left both buttons dead with no explanation.
    withPayableRr()
    renderModal({ currentDebt: 60000, debts: [makeDebt({ remaining_debt_amount: '60000.00' })] })

    selectEasyPay()
    fillAmount('40000')

    expect(screen.getByText(`${K}.validationPaymentExceedsEasypayLimit`)).toBeInTheDocument()
    expect(screen.getByText(`${K}.saveAsPending`).closest('button')).toBeDisabled()
  })

  it('still reports the debt ceiling when that is the lower one', () => {
    withPayableRr()
    renderModal({ currentDebt: 5000, debts: [makeDebt({ remaining_debt_amount: '5000.00' })] })

    fillAmount('9000')

    expect(screen.getByText(`${K}.validationPaymentExceedsDebt`)).toBeInTheDocument()
  })

  it('shows the max hint for a closed-debt correction paid via EasyPay', () => {
    // debtCeiling is Infinity there, so the old code hid the max half of the
    // hint -- while the 29999 cap still applied. No limit, no error, two dead
    // buttons.
    withPayableRr()
    renderModal({
      currentDebt: 0,
      debts: [makeDebt({ remaining_debt_amount: '0.00', status: 'closed' })],
    })

    selectEasyPay()

    expect(screen.getByText(new RegExp(`${K}.max`))).toBeInTheDocument()
  })
})
