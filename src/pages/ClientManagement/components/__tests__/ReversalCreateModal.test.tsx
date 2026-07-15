/**
 * ReversalCreateModal — modal flow tests (KAN-334).
 *
 * Scenarios:
 *   - Renders title, payment picker, 5 amount inputs, comment, total.
 *   - Save disabled until Σ(amounts) equals the selected payment amount.
 *   - Save enabled + posts the expected payload when the sum matches.
 *   - A sum mismatch keeps Save disabled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ReversalCreateModal, type ReversalEligiblePayment } from '../ReversalCreateModal'
import type { CreateReversalRequest, ReversalFieldError } from '@/features/reversals/api/types'

// --- mocks ------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object' && 'defaultValue' in opts) {
        return (opts as { defaultValue: string }).defaultValue
      }
      return key
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mutateSpy = vi.hoisted(() => vi.fn())
const validationErrorsOverride = vi.hoisted(() => ({
  current: null as ReversalFieldError[] | null,
}))

vi.mock('@/features/reversals/hooks/useReversals', () => ({
  reversalKeys: { all: ['reversals'] },
  useCreateReversal: (options?: { onValidationErrors?: (errs: ReversalFieldError[]) => void }) => ({
    isPending: false,
    mutate: (body: CreateReversalRequest, opts?: { onSuccess?: () => void }) => {
      mutateSpy(body)
      if (validationErrorsOverride.current && options?.onValidationErrors) {
        options.onValidationErrors(validationErrorsOverride.current)
        return
      }
      opts?.onSuccess?.()
    },
  }),
}))

// --- fixtures ---------------------------------------------------------------

const ZERO_ORIGINAL = { principal: 0, interest: 0, fine: 0, penalty: 0, commission: 0 }
const payments: ReversalEligiblePayment[] = [
  {
    id: 55001,
    amount: 1500,
    paymentDate: '01.01.2025',
    isReversed: false,
    original: { ...ZERO_ORIGINAL, principal: 1500 },
  },
  {
    id: 55002,
    amount: 5000,
    paymentDate: '02.12.2024',
    isReversed: true,
    original: { ...ZERO_ORIGINAL, principal: 5000 },
  },
]

function renderModal(initialPaymentId: number | null = 55001) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onClose = vi.fn()
  const result = render(
    <QueryClientProvider client={client}>
      <ReversalCreateModal
        open
        onClose={onClose}
        payments={payments}
        initialPaymentId={initialPaymentId}
      />
    </QueryClientProvider>
  )
  return { ...result, onClose }
}

const AMOUNT_PLACEHOLDER = 'pages.clients.detail.reversalModal.amountPlaceholder'

describe('ReversalCreateModal', () => {
  beforeEach(() => {
    mutateSpy.mockClear()
    validationErrorsOverride.current = null
  })

  it('renders title, picker, 5 amount inputs and total', () => {
    renderModal()
    expect(screen.getByText('pages.clients.detail.reversalModal.title')).toBeInTheDocument()
    expect(
      screen.getByText('pages.clients.detail.reversalModal.chooseAPayment')
    ).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText(AMOUNT_PLACEHOLDER)).toHaveLength(5)
    expect(screen.getByText('pages.clients.detail.reversalModal.totalAmount')).toBeInTheDocument()
  })

  it('Save is disabled until the amounts sum to the payment amount', async () => {
    const user = userEvent.setup()
    renderModal()
    const save = screen.getByRole('button', { name: /common\.save/i })
    expect(save).toBeDisabled()

    const inputs = screen.getAllByPlaceholderText(AMOUNT_PLACEHOLDER)
    // principal 1000 + fine 500 = 1500 → matches the 1500 payment.
    await user.type(inputs[0], '1000')
    await user.type(inputs[2], '500')

    await waitFor(() => expect(save).not.toBeDisabled())
  })

  it('a sum mismatch keeps Save disabled', async () => {
    const user = userEvent.setup()
    renderModal()
    const inputs = screen.getAllByPlaceholderText(AMOUNT_PLACEHOLDER)
    await user.type(inputs[0], '100') // 100 ≠ 1500

    const save = screen.getByRole('button', { name: /common\.save/i })
    await waitFor(() => expect(save).toBeDisabled())
  })

  it('submits the expected payload when the sum matches', async () => {
    const user = userEvent.setup()
    renderModal()
    const inputs = screen.getAllByPlaceholderText(AMOUNT_PLACEHOLDER)
    await user.type(inputs[0], '1000') // principal
    await user.type(inputs[2], '500') // fine

    const save = screen.getByRole('button', { name: /common\.save/i })
    await waitFor(() => expect(save).not.toBeDisabled())
    await user.click(save)

    expect(mutateSpy).toHaveBeenCalledTimes(1)
    const body = mutateSpy.mock.calls[0][0] as CreateReversalRequest
    expect(body.payment_id).toBe(55001)
    expect(body.principal).toBe('1000')
    expect(body.fine).toBe('500')
    expect(body.interest).toBe('0')
    expect(body.penalty).toBe('0')
    expect(body.commission).toBe('0')
  })
})
