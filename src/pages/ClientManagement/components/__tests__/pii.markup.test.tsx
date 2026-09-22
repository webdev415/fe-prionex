/**
 * KAN-KB-54 — the markup of `pages/ClientManagement`, phase 3.1.
 *
 * The static audit (`npm run pii-audit`) proves that the SOURCE carries the
 * attribute. It cannot prove that the attribute reaches the DOM: a component
 * that drops unknown props swallows a spread in silence, and nothing in the
 * toolchain — typecheck, lint, the audit itself — notices. These tests render
 * and then ask the DOM, which is the only place where the question has an
 * answer.
 *
 * Both directions are asserted. A screen where everything is asterisks is not a
 * success: it is `privateMode` reached by another route, and a replay in which
 * the operator's screen cannot be told apart is what got `privateMode` rejected
 * on 2026-09-16.
 */

import { describe, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { DeleteClientModal } from '../DeleteClientModal'
import { ClientReversalsTable } from '../ClientReversalsTable'
import { expectObscured, expectNotObscured } from '@/test/piiHelpers'

vi.mock('@/features/clients/hooks/useClients', () => ({
  useDeleteClient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const REVERSAL = {
  reversal_group_id: 'rg-1',
  credit_id: 42,
  client_full_name: 'Петрова Анна Сергіївна',
  user_full_name: 'Коваленко Олег',
  user_id: 9,
  reversal_date: '2026-03-01',
  principal: '100.00',
  interest: '10.00',
  penalty: '0.00',
  total: '110.00',
}

vi.mock('@/features/reversals/hooks/useReversals', () => ({
  useReversals: () => ({ data: { items: [REVERSAL] }, isLoading: false, error: null }),
}))

const CLIENT = {
  id: 123,
  full_name: 'Іванов Іван Іванович',
  tax_id: '1234567890',
  phone_primary: '+380501234567',
  total_debt: 15000.5,
  debt_count: 3,
}

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ClientManagement PII markup — DeleteClientModal', () => {
  it("masks the client's name but not the field label beside it", () => {
    renderWithProviders(
      <DeleteClientModal open onClose={vi.fn()} onSuccess={vi.fn()} client={CLIENT} />
    )
    expectObscured(screen.getByText(CLIENT.full_name))
    // The section heading is the only thing that says WHAT the asterisks are.
    // Marking the whole block would have been one attribute fewer and one
    // unreadable replay more.
    expectNotObscured(screen.getByText('Client Details'))
  })
})

describe('ClientManagement PII markup — ClientReversalsTable', () => {
  it('masks the client and operator columns', () => {
    renderWithProviders(<ClientReversalsTable clientId={123} />)
    expectObscured(screen.getByText(REVERSAL.client_full_name))
    expectObscured(screen.getByText(REVERSAL.user_full_name))
  })

  it('leaves the column headers readable', () => {
    // `Column.obscured` must put the attribute on the body `<td>` and never on
    // the `<th>`: a column title is not personal data, and a table whose headers
    // are asterisks cannot be read in a replay at all.
    renderWithProviders(<ClientReversalsTable clientId={123} />)
    for (const header of screen.getAllByRole('columnheader')) {
      expectNotObscured(header)
    }
  })

  it('leaves the loan number readable', () => {
    // A contract number is not a person. Marking every column "to be safe" costs
    // the replay the one thing it still shows about a reversal and buys nothing:
    // digits are already covered by `obscureTextNumbers` in the tracker options.
    renderWithProviders(<ClientReversalsTable clientId={123} />)
    expectNotObscured(screen.getByText('42'))
  })
})
