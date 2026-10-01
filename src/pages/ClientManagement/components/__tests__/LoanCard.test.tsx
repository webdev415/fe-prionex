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
  // A typed purchase, so the type line of zone 3 prints a word, not a second
  // "—" beside the one the money test below looks for.
  saleType: 'factoring',
  agreementSaleType: 'factoring',
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

const SALE_TYPE_LABEL = 'saleType.label'
const DATE_FA = 'pages.clients.detail.tableHeaders.purchaseDateFa'
const DATE_CESSION = 'pages.clients.detail.tableHeaders.purchaseDateCession'
const DATE_GENERIC = 'pages.clients.detail.tableHeaders.purchaseDateGeneric'
const ISSUE_DATE = 'pages.clients.detail.tableHeaders.issueDate'
const DEBT_TERM = 'pages.clients.detail.tableHeaders.debtTerm'
// One of the few keys the global mock translates (`src/test/setup.ts`).
const LOAN_NUMBER = 'Loan Number'

/** The type line's value (last line of zone 3): the SecRow sibling of its label. */
const saleTypeValue = () => screen.getByText(SALE_TYPE_LABEL).nextElementSibling?.textContent

/** The zone a label sits in: label → its line (MetaLine / AmountCell / SecRow) → zone. */
const zoneOf = (label: string) => {
  const zone = screen.getByText(label).parentElement?.parentElement
  if (!zone) throw new Error(`no zone around "${label}"`)
  return zone
}

describe('LoanCard — contract type in zone 3', () => {
  it.each([
    ['factoring', 'saleType.values.factoring', DATE_FA],
    ['cession', 'saleType.values.cession', DATE_CESSION],
  ])(
    'a %s purchase shows its type and names its agreement on the purchase date',
    (type, word, date) => {
      renderCard({ saleType: type, agreementSaleType: type })

      expect(saleTypeValue()).toBe(word)
      expect(screen.getByText(date)).toBeInTheDocument()
      // Never the other agreement's name — a cession agreement must not read as factoring.
      for (const other of [DATE_FA, DATE_CESSION, DATE_GENERIC].filter((d) => d !== date)) {
        expect(screen.queryByText(other)).not.toBeInTheDocument()
      }
    }
  )

  // The date is the agreement's, so its label follows the agreement's type —
  // even when the debt's copy says otherwise (a type corrected apart, #1619).
  it.each([
    ['cession', 'factoring', 'saleType.values.cession', DATE_FA],
    ['factoring', 'cession', 'saleType.values.factoring', DATE_CESSION],
  ])(
    'a %s debt under a %s agreement: the type line from the debt, the date label from the agreement',
    (debtType, agreementType, word, date) => {
      renderCard({ saleType: debtType, agreementSaleType: agreementType })

      expect(saleTypeValue()).toBe(word)
      expect(screen.getByText(date)).toBeInTheDocument()
      for (const other of [DATE_FA, DATE_CESSION, DATE_GENERIC].filter((d) => d !== date)) {
        expect(screen.queryByText(other)).not.toBeInTheDocument()
      }
    }
  )

  it.each([
    ['absent (server not rolled out yet)', undefined],
    ['null', null],
    ['an unknown value', 'credit'],
  ])('a debt whose own type is %s shows "—" on the type line of zone 3', (_label, saleType) => {
    renderCard({ saleType })

    expect(saleTypeValue()).toBe('—')
    // The line keeps its place under the dates — never an empty spot.
    expect(zoneOf(SALE_TYPE_LABEL)).toBe(zoneOf(ISSUE_DATE))
    expect(zoneOf(ISSUE_DATE).lastElementChild).toContainElement(screen.getByText(SALE_TYPE_LABEL))
  })

  it.each([
    ['absent (server not rolled out yet)', undefined],
    ['null', null],
    ['an unknown value', 'credit'],
  ])(
    'an agreement whose type is %s leaves the purchase date plain',
    (_label, agreementSaleType) => {
      renderCard({ saleType: 'cession', agreementSaleType })

      expect(screen.getByText(DATE_GENERIC)).toBeInTheDocument()
      expect(screen.queryByText(DATE_FA)).not.toBeInTheDocument()
      expect(screen.queryByText(DATE_CESSION)).not.toBeInTheDocument()
      // The debt's own copy is not a stand-in for the agreement's type.
      expect(saleTypeValue()).toBe('saleType.values.cession')
    }
  )

  it('shows the type on a closed card too', () => {
    renderCard({ saleType: 'cession' }, { isClosed: true })

    expect(saleTypeValue()).toBe('saleType.values.cession')
  })

  it.each(['cession', 'factoring'])(
    'a %s debt without an agreement date names no agreement on the empty date',
    (type) => {
      // A debt with no agreement: its type came from its own purchase date, so
      // "by the assignment agreement: —" would name a document that is not there.
      renderCard({ saleType: type, agreementSaleType: type, factoringAgreementPurchaseDate: null })

      expect(saleTypeValue()).toBe(`saleType.values.${type}`)
      const label = screen.getByText(DATE_GENERIC)
      expect(label.nextElementSibling?.textContent).toBe('—')
      expect(screen.queryByText(DATE_FA)).not.toBeInTheDocument()
      expect(screen.queryByText(DATE_CESSION)).not.toBeInTheDocument()
    }
  )

  it('a credit-module loan has no zone 3 — neither the dates nor the type — and no dashes', () => {
    const { container } = renderCard({
      origin: 'credit_module',
      saleType: null,
      agreementSaleType: null,
      principalDebt: null,
      currency: 'CAD',
      lifecycleDetail: null,
    })

    expect(screen.queryByText(SALE_TYPE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(DATE_GENERIC)).not.toBeInTheDocument()
    expect(
      screen.queryByText('pages.clients.detail.tableHeaders.issueDate')
    ).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('—')
  })
})

/**
 * #1617, remark 39431: the 2×2 grid put the dates under the meta and the type
 * in a fourth zone. The card is ONE row of three zones again, the type being
 * the last line of zone 3.
 */
describe('LoanCard — three zones in one row', () => {
  it('zone 3 reads issue date, purchase date, debt term, then the contract type', () => {
    renderCard({ saleType: 'cession', agreementSaleType: 'cession' })

    const lines = Array.from(zoneOf(ISSUE_DATE).children, (l) => l.firstElementChild?.textContent)
    expect(lines).toEqual([ISSUE_DATE, DATE_CESSION, DEBT_TERM, SALE_TYPE_LABEL])
    expect(saleTypeValue()).toBe('saleType.values.cession')
  })

  it('the three zones share the card’s only row — no second row, no fourth zone', () => {
    const { container } = renderCard({ saleType: 'cession' })
    const card = container.firstElementChild as HTMLElement
    const row = zoneOf(LOAN_NUMBER).parentElement

    expect(zoneOf(LBL_PLAIN).parentElement).toBe(row)
    expect(zoneOf(SALE_TYPE_LABEL).parentElement).toBe(row)
    expect(row?.children).toHaveLength(3)
    // Beside the row the card holds only the absolutely positioned "..." menu.
    expect(card.children).toHaveLength(2)
    expect(card.children[0]).toContainElement(screen.getByRole('button', { name: MORE_ACTIONS }))
    expect(card.children[1]).toBe(row)
  })

  it('a credit-module loan keeps zones 1–2 in the same single row', () => {
    renderCard({
      origin: 'credit_module',
      saleType: null,
      agreementSaleType: null,
      principalDebt: null,
      currency: 'CAD',
      lifecycleDetail: null,
    })
    const row = zoneOf(LOAN_NUMBER).parentElement

    expect(zoneOf(LBL_PLAIN).parentElement).toBe(row)
    expect(row?.children).toHaveLength(2)
    expect(screen.queryByText(SALE_TYPE_LABEL)).not.toBeInTheDocument()
  })

  // jsdom computes no layout, so the fold is pinned by its classes: a card-wide
  // container query folds the whole row, and `flex-wrap` — which drops one zone
  // at a time ("2 + 1") — is not there to do it zone by zone.
  it('folds the whole row into one column at the sum of the zone minimums', () => {
    const { container } = renderCard()
    const card = container.firstElementChild as HTMLElement
    const row = zoneOf(LOAN_NUMBER).parentElement as HTMLElement
    const zones = Array.from(row.children)
    const px = (cls: string, re: RegExp) => Number(re.exec(cls)?.[1] ?? NaN)

    expect(card).toHaveClass('@container')
    expect(row).not.toHaveClass('flex-wrap')
    const threshold = px(row.className, /@max-\[(\d+)px\]:flex-col/)
    for (const zone of zones) expect(zone).toHaveClass(`@max-[${threshold}px]:flex-none`)

    // The threshold is exactly what the row needs at its minimums: zones + the
    // two 10px gaps (`gap-2.5`) + side padding. A changed minimum moves it.
    expect(row).toHaveClass('gap-2.5')
    const minimums = zones.reduce((sum, z) => sum + px(z.className, /\bmin-w-\[(\d+)px\]/), 0)
    const padding = px(row.className, /\bpl-\[(\d+)px\]/) + px(row.className, /\bpr-\[(\d+)px\]/)
    expect(minimums).toBe(170 + 342 + 200)
    expect(threshold).toBe(minimums + 2 * 10 + padding)
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
