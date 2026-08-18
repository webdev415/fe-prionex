import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LoansCardList } from '../LoansCardList'
import type { LoanCardLoan } from '../LoanCard'

// `t` is mocked globally to return the key.
const OPEN_HEADING = 'pages.clients.detail.openLoans'
const CLOSED_HEADING = 'pages.clients.detail.closedLoans'

const loan = (id: number, status: 'active' | 'closed'): LoanCardLoan => ({
  id,
  loanNumber: `L-${id}`,
  issueDate: '06-12-2024',
  counterparty: 'Egroshi',
  saleDate: '02-05-2025',
  sellerLegalName: null,
  factoringAgreementPreviousLender: null,
  factoringAgreementPurchaseDate: null,
  principalAmount: 1000,
  principalDebt: 1000,
  remainingDebtAmount: 1000,
  totalToReturn: 1000,
  creditClosedDate: status === 'closed' ? '2026-01-01' : null,
  eligibleForReturn: null,
  creditTermDays: 30,
  status,
  sentToCreditBureau: false,
  creditBureauSentDate: null,
  needsManualClosureReview: false,
})

const loans = [loan(1, 'active'), loan(2, 'active'), loan(3, 'closed')]

function renderList(items: LoanCardLoan[] = loans) {
  const renderLoan = vi.fn((l: LoanCardLoan, isClosed: boolean) => (
    <div key={l.id} data-testid={`loan-${l.id}`} data-closed={isClosed}>
      {l.loanNumber}
    </div>
  ))
  const utils = render(<LoansCardList loans={items} renderLoan={renderLoan} />)
  return { ...utils, renderLoan }
}

describe('LoansCardList', () => {
  it('splits loans into Open and Closed sections with counts', () => {
    renderList()

    const open = screen.getByText(OPEN_HEADING).closest('div')!
    const closed = screen.getByText(CLOSED_HEADING).closest('button')!

    expect(within(open).getByText('2')).toBeInTheDocument()
    expect(within(closed).getByText('1')).toBeInTheDocument()
  })

  it('renders open loans expanded and hides closed ones by default', () => {
    renderList()

    expect(screen.getByTestId('loan-1')).toBeInTheDocument()
    expect(screen.getByTestId('loan-2')).toBeInTheDocument()
    // Closed section is collapsed until the user opens it.
    expect(screen.queryByTestId('loan-3')).not.toBeInTheDocument()
  })

  it('reveals closed loans when the section header is clicked', async () => {
    const user = userEvent.setup()
    renderList()

    await user.click(screen.getByText(CLOSED_HEADING))

    expect(screen.getByTestId('loan-3')).toBeInTheDocument()
  })

  it('tells the renderer which section a loan belongs to', async () => {
    const user = userEvent.setup()
    renderList()

    expect(screen.getByTestId('loan-1')).toHaveAttribute('data-closed', 'false')

    await user.click(screen.getByText(CLOSED_HEADING))
    expect(screen.getByTestId('loan-3')).toHaveAttribute('data-closed', 'true')
  })

  it('keeps both sections with zero counts when there are no loans', () => {
    renderList([])

    const open = screen.getByText(OPEN_HEADING).closest('div')!
    const closed = screen.getByText(CLOSED_HEADING).closest('button')!

    expect(within(open).getByText('0')).toBeInTheDocument()
    expect(within(closed).getByText('0')).toBeInTheDocument()
  })

  it('renders the send-all button and history slots', () => {
    render(
      <LoansCardList
        loans={loans}
        renderLoan={(l) => <div key={l.id} />}
        sendAllButton={<button type="button">send-all</button>}
        ubkiHistory={<div>history</div>}
      />
    )

    expect(screen.getByText('send-all')).toBeInTheDocument()
    expect(screen.getByText('history')).toBeInTheDocument()
  })
})
