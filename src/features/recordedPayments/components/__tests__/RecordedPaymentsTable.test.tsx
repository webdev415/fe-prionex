import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RECORDED_PAYMENTS_COLUMN_COUNT, RecordedPaymentsTable } from '../RecordedPaymentsTable'
import type { RecordedPaymentRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

function makeRow(overrides: Partial<RecordedPaymentRow> = {}): RecordedPaymentRow {
  return {
    payment_id: 918273,
    client_id: 4711,
    client_is_deleted: false,
    debt_id: 5001,
    contract_number: 'ДГ-12345',
    inn: '1234567890',
    amount: '0.00',
    payment_date: '2026-08-09',
    payment_confirmation_date: '2026-08-10',
    verified_at: '2026-08-12T07:15:00Z',
    status: 'verified',
    recorded_by_user_id: 201,
    recorded_by_full_name: 'Записенко Іван',
    assigned_user_id: 202,
    assigned_full_name: 'Коваленко Іван',
    client_responsible_user_id: 6274,
    client_responsible_full_name: 'Договор закрыт',
    client_responsible_is_service: true,
    purchase_date: '2024-03-15',
    seller_name: 'Acme Co',
    payment_method: 'bank_transfer',
    payment_type: null,
    ...overrides,
  }
}

function renderTable(rows: RecordedPaymentRow[], timezone: string | null = 'Europe/Kyiv') {
  return render(
    <MemoryRouter initialEntries={['/dashboard/reports?tab=recorded-payments&rpf=2026-08-01']}>
      <RecordedPaymentsTable
        rows={rows}
        dateFrom="2026-08-01"
        dateTo="2026-08-31"
        timezone={timezone}
        emptyMessage="empty"
      />
    </MemoryRouter>
  )
}

describe('RecordedPaymentsTable', () => {
  it('renders exactly RECORDED_PAYMENTS_COLUMN_COUNT headers — the skeleton’s width', () => {
    renderTable([makeRow()])
    expect(screen.getAllByRole('columnheader')).toHaveLength(RECORDED_PAYMENTS_COLUMN_COUNT)
    expect(RECORDED_PAYMENTS_COLUMN_COUNT).toBe(15)
  })

  it('lists the card’s columns in the card’s order', () => {
    renderTable([makeRow()])
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'pages.reports.recordedPayments.columns.contractNumber',
      'pages.reports.recordedPayments.columns.inn',
      'pages.reports.recordedPayments.columns.amount',
      'pages.reports.recordedPayments.columns.paymentDate',
      'pages.reports.recordedPayments.columns.confirmationDate',
      'pages.reports.recordedPayments.columns.verifiedAt',
      'pages.reports.recordedPayments.columns.status',
      'pages.reports.recordedPayments.columns.client',
      'pages.reports.recordedPayments.columns.recordedBy',
      'pages.reports.recordedPayments.columns.clientResponsible',
      'pages.reports.recordedPayments.columns.paymentResponsible',
      'pages.reports.recordedPayments.columns.purchaseDate',
      'pages.reports.recordedPayments.columns.seller',
      'pages.reports.recordedPayments.columns.paymentMethod',
      'pages.reports.recordedPayments.columns.paymentType',
    ])
  })

  it.each([
    ['verified', 'bg-success-100'],
    ['cancelled', 'bg-error-100'],
    ['pending', 'bg-warning-100'],
  ])('marks the %s status with a text badge on the %s scale', (status, className) => {
    renderTable([makeRow({ status })])
    const badge = screen.getByText(`pages.reports.recordedPayments.status.${status}`)
    expect(badge).toHaveAttribute('data-status', status)
    expect(badge.className).toContain(className)
  })

  it('renders a zero amount as 0.00, never as a dash, and a null type as the placeholder', () => {
    renderTable([makeRow()])
    expect(screen.getByText('0.00')).toBeInTheDocument()
    const cells = screen.getAllByRole('cell')
    expect(cells[cells.length - 1]).toHaveTextContent('—')
  })

  it('flags the service responsible and a deleted client with TEXT badges', () => {
    renderTable([makeRow({ client_is_deleted: true })])
    expect(screen.getByText('pages.reports.recordedPayments.serviceBadge')).toBeInTheDocument()
    expect(
      screen.getByText('pages.reports.recordedPayments.deletedClientBadge')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'pages.reports.recordedPayments.openClient' })
    ).toHaveAttribute('href', '/dashboard/clients/4711')
  })

  it('renders a soft-deleted employee’s ID in the two plain name columns, not «—»', () => {
    renderTable([
      makeRow({
        recorded_by_user_id: 9001,
        recorded_by_full_name: null,
        client_responsible_user_id: 9002,
        client_responsible_full_name: null,
        client_responsible_is_service: false,
      }),
    ])
    const cells = screen.getAllByRole('cell')
    expect(cells[8]).toHaveTextContent('9001')
    expect(cells[9]).toHaveTextContent('9002')
  })

  it('renders «—» for a client the lookup did not resolve (no responsible id, no inn)', () => {
    renderTable([
      makeRow({
        inn: null,
        client_responsible_user_id: null,
        client_responsible_full_name: null,
        client_responsible_is_service: false,
      }),
    ])
    const cells = screen.getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('—')
    expect(cells[9]).toHaveTextContent('—')
  })

  it('formats the CRM confirmation in the profile zone and the bank date as a bare day', () => {
    renderTable([makeRow()])
    expect(screen.getByText('12-08-2026 10:15')).toBeInTheDocument()
    expect(screen.getByText('10-08-2026')).toBeInTheDocument()
  })

  it('renders «—» for a payment with no CRM confirmation instant', () => {
    renderTable([makeRow({ verified_at: null })])
    const cells = screen.getAllByRole('cell')
    expect(cells[5]).toHaveTextContent('—')
  })

  it('renders «—» for the payment’s responsible when the row carries neither id', () => {
    renderTable([
      makeRow({
        assigned_user_id: null,
        assigned_full_name: null,
        recorded_by_user_id: null,
        recorded_by_full_name: null,
      }),
    ])
    const cells = screen.getAllByRole('cell')
    expect(cells[10]).toHaveTextContent('—')
    expect(within(cells[10]).queryByRole('link')).not.toBeInTheDocument()
  })

  it('marks the three name columns as obscured for OpenReplay, and nothing else', () => {
    renderTable([makeRow()])
    const cells = screen.getAllByRole('cell')
    const obscured = cells
      .map((cell, index) => (cell.hasAttribute('data-openreplay-obscured') ? index : -1))
      .filter((index) => index >= 0)
    expect(obscured).toEqual([8, 9, 10])
  })

  it('shows the empty message when there are no rows', () => {
    renderTable([])
    expect(screen.getByText('empty')).toBeInTheDocument()
  })
})
