/**
 * PaymentDebtBreakdown Component Tests
 *
 * Phase 5 of the payment-allocation-snapshot requirement
 * (prionex-docs/repo-docs/requirements/2026-05-20-1400-payment-allocation-snapshot).
 * Covers the defensive "Unmatched / Overpayment" row added in Phase 5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PaymentDebtBreakdown } from '../PaymentDebtBreakdown'
import * as usePaymentsModule from '@/features/payments/hooks/usePayments'

vi.mock('@/features/payments/hooks/usePayments')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const mockUsePayment = vi.spyOn(usePaymentsModule, 'usePayment')
const mockUseBreakdown = vi.spyOn(usePaymentsModule, 'usePaymentDebtBreakdown')

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const SAMPLE_PAYMENT = {
  paymentId: '123',
  status: 'verified',
  debt_id: 42,
}

const SAMPLE_ALLOCATION = [
  {
    component: 'principal' as const,
    component_label: 'Principal',
    original_amount: 1000,
    allocated_amount: 500,
    paid_amount: 500,
    written_off_amount: 0,
    remaining_balance: 500,
  },
  {
    component: 'interest' as const,
    component_label: 'Interest',
    original_amount: 0,
    allocated_amount: 0,
    remaining_balance: 0,
  },
  {
    component: 'fees' as const,
    component_label: 'Fees',
    original_amount: 0,
    allocated_amount: 0,
    remaining_balance: 0,
  },
  {
    component: 'penalties' as const,
    component_label: 'Penalties',
    original_amount: 0,
    allocated_amount: 0,
    remaining_balance: 0,
  },
  {
    component: 'fines' as const,
    component_label: 'Fines',
    original_amount: 0,
    allocated_amount: 0,
    remaining_balance: 0,
  },
]

function makeBreakdown(overrides: Record<string, unknown> = {}) {
  return {
    payment_number: 'PAY-TEST',
    payment_amount: 500,
    payment_status: 'verified',
    debt_id: 42,
    contract_number: 'LOAN-TEST',
    allocation: SAMPLE_ALLOCATION,
    total_original: 1000,
    total_paid: 500,
    total_written_off: 0,
    total_allocated: 500,
    unmatched: 0,
    total_remaining_debt: 500,
    allocation_method: 'stored' as const,
    allocation_at: '2026-05-20T14:00:00Z',
    computed_at: '2026-05-20T14:00:00Z',
    ...overrides,
  }
}

describe('PaymentDebtBreakdown — Unmatched/Overpayment row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePayment.mockReturnValue({ data: SAMPLE_PAYMENT, isLoading: false } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  })

  it('renders the Unmatched row when unmatched > 0.01', () => {
    mockUseBreakdown.mockReturnValue({
      data: makeBreakdown({ unmatched: 250, total_allocated: 250 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    renderWithClient(<PaymentDebtBreakdown paymentId="123" />)
    expect(screen.getByText('breakdown.unmatched')).toBeInTheDocument()
  })

  it('renders the Paid and Written-off column headers', () => {
    mockUseBreakdown.mockReturnValue({
      data: makeBreakdown(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    renderWithClient(<PaymentDebtBreakdown paymentId="123" />)
    expect(screen.getByText('breakdown.paid')).toBeInTheDocument()
    expect(screen.getByText('breakdown.written_off')).toBeInTheDocument()
  })

  it('does NOT render the Unmatched row when unmatched is 0', () => {
    mockUseBreakdown.mockReturnValue({
      data: makeBreakdown({ unmatched: 0 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    renderWithClient(<PaymentDebtBreakdown paymentId="123" />)
    expect(screen.queryByText('breakdown.unmatched')).not.toBeInTheDocument()
  })

  it('does NOT render the Unmatched row when unmatched is below the 0.01 threshold', () => {
    mockUseBreakdown.mockReturnValue({
      data: makeBreakdown({ unmatched: 0.005 }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    renderWithClient(<PaymentDebtBreakdown paymentId="123" />)
    expect(screen.queryByText('breakdown.unmatched')).not.toBeInTheDocument()
  })

  it('handles missing `unmatched` field gracefully (old-backend compatibility)', () => {
    // Old backend response has no `unmatched` field — frontend treats as 0.
    const breakdown = makeBreakdown()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (breakdown as any).unmatched

    mockUseBreakdown.mockReturnValue({
      data: breakdown,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    renderWithClient(<PaymentDebtBreakdown paymentId="123" />)
    expect(screen.queryByText('breakdown.unmatched')).not.toBeInTheDocument()
  })

  it('renders the breakdown for cancelled snapshotted payments', () => {
    // H-3: cancelled snapshotted payments must keep displaying their
    // historical allocation. The BE preserves ``allocated_*`` across
    // cancel; the FE surfaces the cancelled state via an inline badge
    // rather than hiding the table.

    mockUsePayment.mockReturnValue({
      data: { ...SAMPLE_PAYMENT, status: 'cancelled' },
      isLoading: false,
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    mockUseBreakdown.mockReturnValue({
      data: makeBreakdown({ payment_status: 'cancelled' }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    renderWithClient(<PaymentDebtBreakdown paymentId="123" />)

    // Cancelled badge present.
    expect(screen.getByText('breakdown.cancelled_note')).toBeInTheDocument()
    // Allocation table rendered (not the placeholder). Look for any
    // component label — they all map through componentLabels at render.
    expect(screen.getByText('breakdown.principal')).toBeInTheDocument()
    expect(screen.getByText('breakdown.component')).toBeInTheDocument()
  })

  it('renders identical UI for stored and legacy allocation_method (no visible distinction)', () => {
    // Stored row first
    mockUseBreakdown.mockReturnValue({
      data: makeBreakdown({ allocation_method: 'stored' }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    const { unmount } = renderWithClient(<PaymentDebtBreakdown paymentId="123" />)
    expect(screen.queryByText('breakdown.unmatched')).not.toBeInTheDocument()
    unmount()

    // Legacy row — no allocation_at, allocation_method='computed'
    mockUseBreakdown.mockReturnValue({
      data: makeBreakdown({
        allocation_method: 'computed',
        allocation_at: null,
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    renderWithClient(<PaymentDebtBreakdown paymentId="123" />)
    // Same UI — no extra distinguishing element.
    expect(screen.queryByText('breakdown.unmatched')).not.toBeInTheDocument()
  })
})
