import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { SellerDetailPage } from '../SellerDetailPage'

const agreements = vi.hoisted(() => ({ items: [] as Array<Record<string, unknown>> }))

// The barrel is mocked wholesale: the page must read the sale type rule by its
// direct path, or this mock would blank it out.
vi.mock('@/features/sellers', () => ({
  useSellerDetail: () => ({
    data: { id: 7, seller_name: 'Egroshi', legal_name: 'ТОВ «ФК»' },
    isLoading: false,
    isError: false,
  }),
  useSellerFactoringAgreements: () => ({
    data: { items: agreements.items, total: agreements.items.length, page: 1, page_size: 10 },
    isLoading: false,
    isError: false,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  agreements.items = []
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/sellers/7']}>
        <Routes>
          <Route path="/dashboard/sellers/:id" element={<SellerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const COLUMNS = 'pages.sellers.detail.factoringAgreements.columns'

/** Body rows as arrays of cell texts, in column order. */
function bodyRows() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    )
}

describe('SellerDetailPage — agreements table', () => {
  it('puts the contract type column right after the purchase date', () => {
    agreements.items = [
      { id: 1, agreement_number: 'A-1', contract_purchase_date: '2026-09-18', debt_count: 3 },
    ]
    renderPage()

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      `${COLUMNS}.number`,
      `${COLUMNS}.previousLender`,
      `${COLUMNS}.purchaseDate`,
      `${COLUMNS}.saleType`,
      `${COLUMNS}.debtCount`,
    ])
  })

  it('shows each agreement type, and "—" where there is none', () => {
    agreements.items = [
      {
        id: 1,
        agreement_number: 'A-1',
        previous_lender: 'Lender',
        contract_purchase_date: '2026-09-18',
        sale_type: 'cession',
        debt_count: 3,
      },
      {
        id: 2,
        agreement_number: 'B-2',
        previous_lender: 'Old lender',
        contract_purchase_date: '2025-01-10',
        sale_type: 'factoring',
        debt_count: 12,
      },
      // A client-service not rolled out yet sends no type at all.
      { id: 3, agreement_number: 'C-3', contract_purchase_date: '2025-02-01', debt_count: 1 },
      { id: 4, agreement_number: 'D-4', sale_type: null, debt_count: 0 },
      { id: 5, agreement_number: 'E-5', sale_type: 'credit', debt_count: 0 },
    ]
    renderPage()

    const rows = bodyRows()
    expect(rows.map((cells) => cells[3])).toEqual([
      'saleType.values.cession',
      'saleType.values.factoring',
      '—',
      '—',
      '—',
    ])
    // The new column shifts nothing else: the count stays last.
    expect(rows.map((cells) => cells[4])).toEqual(['3', '12', '1', '0', '0'])
  })
})
