/**
 * PaymentsCollectedModal — a KPI without a trend (#1448): report-service may
 * answer `payments_collected.trend: null`, and the page then passes no trend.
 *
 * react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaymentsCollectedModal, type PaymentData } from '../components/PaymentsCollectedModal'

function paymentData(overrides: Partial<PaymentData> = {}): PaymentData {
  return {
    totalAmount: 1500,
    paymentCount: 3,
    verifiedAmount: 1000,
    pendingAmount: 500,
    averageAmount: 500,
    largestAmount: 800,
    paymentMethods: [],
    ...overrides,
  }
}

function renderModal(data: PaymentData) {
  return render(<PaymentsCollectedModal open onClose={vi.fn()} period="today" data={data} />)
}

describe('PaymentsCollectedModal without a KPI trend (#1448)', () => {
  it('shows the trend row when the KPI has a trend', () => {
    renderModal(paymentData({ trend: { change: 12, direction: 'up' } }))

    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.kpi.vs')).toBeInTheDocument()
  })

  it('renders the payments without a trend row when no trend is passed', () => {
    renderModal(paymentData())

    expect(screen.getByText('pages.reports.paymentsModal.title')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.paymentsModal.payments')).toBeInTheDocument()
    expect(screen.queryByText('pages.reports.kpi.vs')).not.toBeInTheDocument()
    expect(screen.queryByText(/^\d+%$/)).not.toBeInTheDocument()
  })
})
