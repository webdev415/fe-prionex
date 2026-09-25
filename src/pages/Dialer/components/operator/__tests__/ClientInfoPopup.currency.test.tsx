import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ClientCallSummary } from '@/features/dialer'
import { setActiveCurrency } from '@/lib/projectCurrency'

import { ClientInfoPopup } from '../ClientInfoPopup'

const summary: ClientCallSummary = {
  client_id: 42,
  status: 'active',
  tax_id: '3456789012',
  tags: [],
  currency: '₴',
  total_paid: 15450,
  progress_pct: 15,
  total_payments: { amount: 125450, count: 23 },
  verified: { amount: 105450, count: 20 },
  pending: { amount: 25000, count: 3 },
  loan: null,
  recent_interactions: [],
}

vi.mock('@/features/dialer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/dialer')>()
  return {
    ...actual,
    useClientCallSummary: () => ({ data: summary, isLoading: false }),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

function renderPopup() {
  render(
    <ClientInfoPopup
      open
      onClose={() => {}}
      clientId={42}
      clientName="Ivanenko Oleksiy Petrovych"
      phone="380682370112"
    />
  )
}

describe('ClientInfoPopup amounts', () => {
  afterEach(() => {
    setActiveCurrency('UAH')
  })

  it('shows euros in a euro project', () => {
    setActiveCurrency('EUR')
    renderPopup()

    expect(screen.getByText('€15,450.00')).toBeInTheDocument()
    expect(screen.queryByText(/₴/)).not.toBeInTheDocument()
  })

  it('shows hryvnia in a hryvnia project', () => {
    renderPopup()

    expect(screen.getByText('₴ 15,450.00')).toBeInTheDocument()
  })
})
