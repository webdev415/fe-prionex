import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ClientInfoPopup } from '../ClientInfoPopup'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('ClientInfoPopup', () => {
  it('renders the payment tiles and recent interactions from the mock summary', async () => {
    render(
      <ClientInfoPopup
        open
        onClose={() => {}}
        clientId={900001}
        clientName="Ivanenko Oleksiy Petrovych"
        phone="380682370112"
      />,
      { wrapper }
    )

    expect(screen.getByText('Ivanenko Oleksiy Petrovych')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('15%')).toBeInTheDocument())
    expect(screen.getByText('Total Payments')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Client busy, requested a call after 2 PM.')).toBeInTheDocument()
  })
})
