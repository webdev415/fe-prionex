import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LoanCard, type LoanCardAction, type LoanCardLoan } from '../LoanCard'

// Radix menus probe pointer capture, which jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

// `t` is mocked globally to return the key, so label assertions target keys.
const LBL_LAWFUL = 'pages.clients.detail.tableHeaders.remainingDebtLawful'
const LBL_PLAIN = 'pages.clients.detail.tableHeaders.remainingDebtAmount'
const TXT_PLAIN_LINE = 'pages.clients.detail.remainingDebtPlain'
const TXT_PAYMENTS_LINE = 'pages.clients.detail.includingPayments'
const MORE_ACTIONS = 'pages.clients.detail.moreActions'

const baseLoan: LoanCardLoan = {
  id: 1,
  loanNumber: '3854790',
  issueDate: '06-12-2024',
  counterparty: 'Egroshi',
  saleDate: '02-05-2025',
  sellerLegalName: 'LLC "FC "YE GROSHI"',
  factoringAgreementPreviousLender: null,
  factoringAgreementPurchaseDate: '10-05-2025',
  principalAmount: 10136,
  principalDebt: 10086,
  remainingDebtAmount: 37414.38,
  totalToReturn: 37414.38,
  creditClosedDate: null,
  eligibleForReturn: null,
  creditTermDays: 540,
  status: 'active',
  sentToCreditBureau: false,
  creditBureauSentDate: null,
  closingCoefficient: null,
  needsManualClosureReview: false,
}

function renderCard(
  loan: Partial<LoanCardLoan> = {},
  props: Partial<React.ComponentProps<typeof LoanCard>> = {}
) {
  return render(
    <LoanCard
      loan={{ ...baseLoan, ...loan }}
      isClosed={false}
      hasRr={false}
      rrExpanded={false}
      onToggleRr={vi.fn()}
      focused={false}
      onFocus={vi.fn()}
      actions={[]}
      {...props}
    />
  )
}

/** Money renders with non-breaking spaces; Testing Library's default
 *  normalizer collapses those to plain spaces, so queries use plain spaces. */
describe('LoanCard — remaining debt column', () => {
  it('shows the plain label and remaining debt when there is no lawful figure', () => {
    renderCard({ eligibleForReturn: null })

    expect(screen.getByText(LBL_PLAIN)).toBeInTheDocument()
    expect(screen.queryByText(LBL_LAWFUL)).not.toBeInTheDocument()
    expect(screen.getByText('₴ 37 414.38')).toBeInTheDocument()
  })

  it('stays on the plain label when the lawful figure equals remaining debt', () => {
    // ~40% of debts carry a legacy_f53 identical to remaining_debt_amount;
    // qualifying those as "(Lawful)" would label a duplicate number.
    renderCard({ eligibleForReturn: 37414.38, remainingDebtAmount: 37414.38 })

    expect(screen.getByText(LBL_PLAIN)).toBeInTheDocument()
    expect(screen.queryByText(LBL_LAWFUL)).not.toBeInTheDocument()
    expect(screen.queryByText(TXT_PLAIN_LINE)).not.toBeInTheDocument()
  })

  it('pairs the lawful label with the lawful value when the two diverge', () => {
    renderCard({ eligibleForReturn: 4000, remainingDebtAmount: 6200, totalToReturn: 6200 })

    expect(screen.getByText(LBL_LAWFUL)).toBeInTheDocument()
    expect(screen.queryByText(LBL_PLAIN)).not.toBeInTheDocument()
    // The headline value must be the field the label names.
    expect(screen.getByText('₴ 4 000.00')).toBeInTheDocument()
    // …and the ordinary remaining debt is kept, not dropped.
    expect(screen.getByText(TXT_PLAIN_LINE)).toBeInTheDocument()
  })
})

describe('LoanCard — payments breakdown', () => {
  it('omits the payments line when no payment has moved the figure', () => {
    renderCard({ remainingDebtAmount: 37414.38, totalToReturn: 37414.38 })

    expect(screen.queryByText(TXT_PAYMENTS_LINE)).not.toBeInTheDocument()
  })

  it('shows the payments line once a payment has been applied', () => {
    renderCard({ remainingDebtAmount: 37414.38, totalToReturn: 35914.38 })

    expect(screen.getByText(TXT_PAYMENTS_LINE)).toBeInTheDocument()
  })

  it('shows both the plain remaining debt and the payments line together', () => {
    // Lawful figure diverges *and* payments exist — neither may displace the other.
    renderCard({ eligibleForReturn: 4000, remainingDebtAmount: 6200, totalToReturn: 5000 })

    expect(screen.getByText(LBL_LAWFUL)).toBeInTheDocument()
    expect(screen.getByText(TXT_PLAIN_LINE)).toBeInTheDocument()
    expect(screen.getByText(TXT_PAYMENTS_LINE)).toBeInTheDocument()
  })
})

describe('LoanCard — money formatting', () => {
  it('keeps an amount on one line by binding its thousands separator', () => {
    const { container } = renderCard({ principalAmount: 10136 })

    // A plain space would let "₴ 10 136.00" wrap mid-number.
    expect(container.textContent).toContain('₴ 10 136.00')
  })

  it('renders a dash when principal debt is absent, and zero as an amount', () => {
    const { unmount } = renderCard({ principalDebt: null })
    expect(screen.getByText('—')).toBeInTheDocument()
    unmount()

    renderCard({ principalDebt: 0 })
    // 0 is a real value, not missing data.
    expect(screen.getByText('₴ 0.00')).toBeInTheDocument()
  })
})

describe('LoanCard — action menu', () => {
  const actions: LoanCardAction[] = [
    { key: 'calc', label: 'Detailed calculation', onSelect: vi.fn() },
    { key: 'close', label: 'Close loan', onSelect: vi.fn(), hidden: true },
    { key: 'ubki', label: 'Sent on 12-08-2026', onSelect: vi.fn(), disabled: true },
  ]

  it('renders only actions that are not hidden', async () => {
    const user = userEvent.setup()
    renderCard({}, { actions })

    await user.click(screen.getByRole('button', { name: MORE_ACTIONS }))

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Detailed calculation')).toBeInTheDocument()
    expect(within(menu).getByText('Sent on 12-08-2026')).toBeInTheDocument()
    // Hidden actions are absent, not greyed out.
    expect(within(menu).queryByText('Close loan')).not.toBeInTheDocument()
  })

  it('marks a disabled action as disabled rather than dropping it', async () => {
    const user = userEvent.setup()
    renderCard({}, { actions })

    await user.click(screen.getByRole('button', { name: MORE_ACTIONS }))

    const item = await screen.findByRole('menuitem', { name: 'Sent on 12-08-2026' })
    expect(item).toHaveAttribute('data-disabled')
  })

  it('does not toggle card focus when the menu trigger is clicked', async () => {
    const user = userEvent.setup()
    const onFocus = vi.fn()
    renderCard({}, { actions, onFocus })

    await user.click(screen.getByRole('button', { name: MORE_ACTIONS }))

    expect(onFocus).not.toHaveBeenCalled()
  })
})

describe('LoanCard — closed and focused states', () => {
  it('veils a closed card', () => {
    const { container } = renderCard({}, { isClosed: true })

    expect(container.querySelector('[aria-hidden]')).toBeInTheDocument()
  })

  it('does not veil a closed card while it is focused', () => {
    const { container } = renderCard({}, { isClosed: true, focused: true })

    expect(container.querySelector('[aria-hidden]')).not.toBeInTheDocument()
  })

  it('shows the closure date inline on a closed card, formatted', () => {
    renderCard({ creditClosedDate: '2026-01-01T00:00:00' }, { isClosed: true })

    // Raw ISO is kept in the model for the edit action; display is DD-MM-YYYY.
    expect(screen.getByText(/01-01-2026/)).toBeInTheDocument()
  })
})
