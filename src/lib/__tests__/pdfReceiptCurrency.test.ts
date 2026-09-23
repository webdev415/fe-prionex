import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatePaymentReceiptPDF, type PaymentReceiptData } from '@/lib/pdfReceiptGenerator'
import { setActiveCurrency } from '@/lib/projectCurrency'

const written = vi.hoisted(() => [] as string[])

vi.mock('@/lib/loadNotoFont', () => ({ loadNotoSansFont: vi.fn() }))

vi.mock('jspdf', () => {
  class FakePdf {
    internal = { pageSize: { getHeight: () => 297, getWidth: () => 210 } }
    text(value: string | string[]) {
      written.push(...[value].flat())
      return this
    }
    getTextWidth() {
      return 10
    }
    getFontList() {
      return {}
    }
    line() {
      return this
    }
    rect() {
      return this
    }
    save() {}
    setDrawColor() {
      return this
    }
    setFont() {
      return this
    }
    setFontSize() {
      return this
    }
    setLineWidth() {
      return this
    }
    setTextColor() {
      return this
    }
  }
  return { default: FakePdf, jsPDF: FakePdf }
})

const receipt: PaymentReceiptData = {
  receiptNumber: 'R-1',
  paymentId: '1',
  dateIssued: '2026-09-18',
  clientName: 'Lucía García',
  clientId: '42',
  phone: '+34600000000',
  contract: 'C-1',
  paymentDate: '2026-09-18',
  paymentMethod: 'Bank Transfer',
  transactionRef: 'T-1',
  paymentAmount: 1234.5,
  status: 'Verified',
  outstandingBalanceBefore: 5000,
  paymentApplied: -1234.5,
  remainingBalance: 3765.5,
  receivedBy: 'operator',
}

describe('payment receipt amounts', () => {
  afterEach(() => {
    written.length = 0
    setActiveCurrency('UAH')
  })

  it('writes euros for a euro project', () => {
    setActiveCurrency('EUR')

    generatePaymentReceiptPDF(receipt)

    const text = written.join('\n').replace(/\s/g, ' ')
    expect(text).toContain('1234,50 €')
    expect(text).toContain('-1234,50 €')
    expect(text).not.toContain('₴')
    expect(text).not.toContain('UAH')
  })

  it('keeps hryvnia for a hryvnia project', () => {
    generatePaymentReceiptPDF(receipt)

    expect(written.join('\n')).toContain('₴')
  })
})
