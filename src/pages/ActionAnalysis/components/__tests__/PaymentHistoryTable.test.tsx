/**
 * Render tests for PaymentHistoryTable (KAN-506).
 *
 * The i18n mock in `src/test/setup.ts` returns translation keys verbatim
 * when no entry exists, so we assert on keys for badge labels.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { PaymentHistoryTable } from '../PaymentHistoryTable'
import type { PaymentMonitoringItem } from '@/features/actionAnalysis'

function makeRow(overrides: Partial<PaymentMonitoringItem> = {}): PaymentMonitoringItem {
  return {
    id: 1,
    payment_number: 'PAY-001',
    client_id: 100,
    debt_id: 901,
    debt_contract_number: 'LN-001',
    seller_company: 'Acme',
    purchase_date: '2024-03-15',
    payment_type: 'payment_by_rr',
    recorded_by_user_id: 10,
    recorded_by_full_name: 'Alice Adams',
    recorded_at: '2026-05-10T12:00:00Z',
    verified_at: '2026-05-10T13:00:00Z',
    amount: '123.45',
    payment_method: 'card',
    status: 'verified',
    ...overrides,
  }
}

function renderTable(rows: PaymentMonitoringItem[]) {
  return render(
    <MemoryRouter>
      <PaymentHistoryTable data={rows} sort="recorded_at_desc" onSortChange={vi.fn()} />
    </MemoryRouter>
  )
}

describe('PaymentHistoryTable', () => {
  it('renders the loan number and operator', () => {
    renderTable([makeRow()])
    expect(screen.getByText('LN-001')).toBeInTheDocument()
    expect(screen.getByText('Alice Adams')).toBeInTheDocument()
  })

  it('translates KAN-507 payment_type values via i18n keys', () => {
    renderTable([makeRow({ payment_type: 'partial_payment' })])
    expect(
      screen.getByText('pages.actionAnalysis.filters.paymentTypes.partial_payment')
    ).toBeInTheDocument()
  })

  it('renders legacy free-text payment_type verbatim (pre-KAN-507 rows)', () => {
    renderTable([makeRow({ payment_type: 'основной долг' })])
    expect(screen.getByText('основной долг')).toBeInTheDocument()
  })

  it('shows em-dash for missing verified_at and purchase_date', () => {
    renderTable([
      makeRow({
        id: 99,
        verified_at: null,
        purchase_date: null,
        debt_contract_number: 'LN-X',
        recorded_by_full_name: 'Bob',
        payment_type: 'full_payment',
      }),
    ])
    // Two em-dashes: Date of loan sale + Confirmed at
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders the status badge with the correct i18n key', () => {
    renderTable([makeRow({ status: 'cancelled' })])
    expect(
      screen.getByText('pages.actionAnalysis.filters.paymentStatuses.cancelled')
    ).toBeInTheDocument()
  })

  it('renders the payment_method badge with the correct i18n key', () => {
    renderTable([makeRow({ payment_method: 'bank_transfer' })])
    expect(
      screen.getByText('pages.actionAnalysis.filters.paymentMethods.bank_transfer')
    ).toBeInTheDocument()
  })

  it('formats amount with thousands separator and two decimals', () => {
    renderTable([makeRow({ amount: '12345.6' })])
    // Locale-formatted (default en): "12,345.60"
    expect(screen.getByText('12,345.60')).toBeInTheDocument()
  })

  it('renders the client cell as a link to /dashboard/clients/:id', () => {
    renderTable([makeRow({ client_id: 555 })])
    const link = screen.getByText('#555').closest('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/dashboard/clients/555')
  })

  it('renders the sort selector with the active value visible', () => {
    renderTable([makeRow()])
    expect(screen.getByText('pages.actionAnalysis.filters.sortBy')).toBeInTheDocument()
  })
})
