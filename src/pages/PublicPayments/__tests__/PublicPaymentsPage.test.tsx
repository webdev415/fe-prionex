/**
 * PublicPaymentsPage — behaviour tests for the EasyPay portal.
 *
 * Covers the ticket's acceptance criteria:
 *   - 2-field form (TIN + Credit Agreement Number)
 *   - not_found  → correct error message
 *   - closed     → status message + "Check again"
 *   - open       → amount modal with 29 999 UAH limit
 *   - exceeding the limit → error message
 *   - valid amount → redirect to the payment system page
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import en from '@/../public/locales/en/easypay.json'

// ── Real English translator so assertions verify the exact ticket copy ──────────
function translate(key: string, opts?: Record<string, unknown>): string {
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part]
    return undefined
  }, en)
  if (typeof value !== 'string') return key
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(opts?.[name] ?? ''))
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// ── Mock the EasyPay API module ─────────────────────────────────────────────────
const validateCredit = vi.hoisted(() => vi.fn())
const initiatePayment = vi.hoisted(() => vi.fn())

vi.mock('@/features/easypay', () => {
  class EasyPayApiError extends Error {
    status?: number
    detail?: string
    constructor(message: string, status?: number, detail?: string) {
      super(message)
      this.name = 'EasyPayApiError'
      this.status = status
      this.detail = detail
    }
  }
  return {
    easypayApi: { validateCredit, initiatePayment },
    EasyPayApiError,
  }
})

import { PublicPaymentsPage } from '../PublicPaymentsPage'
import { EasyPayApiError } from '@/features/easypay'

async function submitLookup(tin = '1234567890', contract = 'LOAN-1') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(en.form.tinLabel), tin)
  await user.type(screen.getByLabelText(en.form.contractLabel), contract)
  await user.click(screen.getByRole('button', { name: en.form.submit }))
  return user
}

describe('PublicPaymentsPage', () => {
  let assignSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    validateCredit.mockReset()
    initiatePayment.mockReset()
    assignSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders exactly two fields: TIN and Credit Agreement Number', () => {
    render(<PublicPaymentsPage />)
    expect(screen.getByLabelText(en.form.tinLabel)).toBeInTheDocument()
    expect(screen.getByLabelText(en.form.contractLabel)).toBeInTheDocument()
    // No legacy fields
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/purpose/i)).not.toBeInTheDocument()
  })

  it('scenario 1 — credit not found shows the error message', async () => {
    validateCredit.mockResolvedValue({ status: 'not_found' })
    render(<PublicPaymentsPage />)
    await submitLookup()
    expect(await screen.findByText(en.result.notFound)).toBeInTheDocument()
  })

  it('scenario 2 — closed credit shows status + "Check again" button', async () => {
    validateCredit.mockResolvedValue({
      status: 'closed',
      contract_number: 'CN-100',
      debt_id: 10,
      client_id: 5,
    })
    render(<PublicPaymentsPage />)
    const user = await submitLookup('1234567890', 'CN-100')
    expect(await screen.findByText('Debt #CN-100 is closed.')).toBeInTheDocument()

    const checkAgain = screen.getByRole('button', { name: en.result.checkAgain })
    await user.click(checkAgain)
    // Message cleared and fields reset
    expect(screen.queryByText('Debt #CN-100 is closed.')).not.toBeInTheDocument()
    expect(screen.getByLabelText(en.form.tinLabel)).toHaveValue('')
  })

  it('scenario 3 — open credit opens the amount modal', async () => {
    validateCredit.mockResolvedValue({
      status: 'open',
      contract_number: 'CN-200',
      debt_id: 11,
      client_id: 6,
      remaining_debt_amount: '50000.00',
      max_payment_amount: '29999.00',
    })
    render(<PublicPaymentsPage />)
    await submitLookup('1234567890', 'CN-200')

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(en.amount.title)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(en.amount.label)).toBeInTheDocument()
  })

  it('rejects an amount above the 29 999 UAH limit', async () => {
    validateCredit.mockResolvedValue({
      status: 'open',
      contract_number: 'CN-200',
      debt_id: 11,
      client_id: 6,
      remaining_debt_amount: '50000.00',
      max_payment_amount: '29999.00',
    })
    render(<PublicPaymentsPage />)
    const user = await submitLookup('1234567890', 'CN-200')

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(en.amount.label), '30000')
    await user.click(within(dialog).getByRole('button', { name: en.amount.pay }))

    expect(await within(dialog).findByText(/cannot exceed/i)).toBeInTheDocument()
    expect(initiatePayment).not.toHaveBeenCalled()
  })

  it('redirects to the payment page for a valid amount', async () => {
    validateCredit.mockResolvedValue({
      status: 'open',
      contract_number: 'CN-200',
      debt_id: 11,
      client_id: 6,
      remaining_debt_amount: '50000.00',
      max_payment_amount: '29999.00',
    })
    initiatePayment.mockResolvedValue({
      order_id: 'EP-ABC',
      payment_id: 99,
      redirect_url: 'https://easypay.ua/checkout?orderId=EP-ABC',
      amount: '1500.00',
    })
    render(<PublicPaymentsPage />)
    const user = await submitLookup('1234567890', 'CN-200')

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(en.amount.label), '1500')
    await user.click(within(dialog).getByRole('button', { name: en.amount.pay }))

    await waitFor(() => {
      expect(initiatePayment).toHaveBeenCalledWith({
        tin: '1234567890',
        contract_number: 'CN-200',
        amount: '1500.00',
      })
    })
    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('https://easypay.ua/checkout?orderId=EP-ABC')
    })
  })

  it('shows a portal-unavailable message on 401', async () => {
    validateCredit.mockRejectedValue(new EasyPayApiError('unauthorized', 401))
    render(<PublicPaymentsPage />)
    await submitLookup()
    expect(await screen.findByText(en.errors.portalNotConfigured)).toBeInTheDocument()
  })
})
