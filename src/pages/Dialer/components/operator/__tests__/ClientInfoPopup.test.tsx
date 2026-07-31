import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ClientCallSummary } from '@/features/dialer'

import { ClientInfoPopup } from '../ClientInfoPopup'

const summary: ClientCallSummary = {
  client_id: 42,
  status: 'active',
  tax_id: '3456789012',
  tags: ['tag 1'],
  currency: '₴',
  total_paid: 15450,
  progress_pct: 15,
  total_payments: { amount: 125450, count: 23 },
  verified: { amount: 105450, count: 20 },
  pending: { amount: 25000, count: 3 },
  loan: null,
  recent_interactions: [
    {
      id: 1,
      type_name: 'Outbound Call',
      interaction_date: '2026-05-12',
      summary: 'Client busy, requested a call after 2 PM.',
    },
  ],
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

describe('ClientInfoPopup', () => {
  it('renders the payment tiles and recent interactions from the call summary', () => {
    render(
      <ClientInfoPopup
        open
        onClose={() => {}}
        clientId={42}
        clientName="Ivanenko Oleksiy Petrovych"
        phone="380682370112"
      />
    )

    expect(screen.getByText('Ivanenko Oleksiy Petrovych')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText('Total Payments')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Client busy, requested a call after 2 PM.')).toBeInTheDocument()
  })
})
