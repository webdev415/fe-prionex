/**
 * Filter-UX coverage for SuccessfulClosuresSubTab (KAN-1027/KAN-1029 UX
 * follow-up). The closures hook keeps previous data on a filter change
 * (`placeholderData: keepPreviousData`), so the table must:
 *   1) show an explicit refetch overlay while the new request is in flight
 *      (instead of silently presenting the previous filter's rows), and
 *   2) show the empty state — not stale rows — once an empty page settles.
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

vi.mock('@/features/users/hooks', () => ({
  useOperators: () => ({
    data: [{ id: 41, full_name: 'Kateryna Antonova', department_name: 'Hard Collection' }],
  }),
}))

// Funnel context queries — settled, minimal totals.
vi.mock('@/features/training/hooks/useInteractionMonitoring', () => ({
  useInteractionMonitoring: () => ({
    data: { items: [], total: 10, page: 1, page_size: 1 },
    isLoading: false,
    isError: false,
    isFetching: false,
  }),
}))
vi.mock('@/features/training/hooks/usePromisesAndCallbacks', () => ({
  usePromisesAndCallbacks: () => ({
    data: { items: [], total: 4, page: 1, page_size: 1 },
    isLoading: false,
    isError: false,
    isFetching: false,
  }),
}))

const closuresMock = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  isFetching: false,
  data: {
    summary_cards: { successful_closures_count: 1, total_amount: '2500' },
    closure_leader: { operator_id: 41, operator_name: 'Kateryna Antonova', closures_count: 1 },
    items: [
      {
        payment_date: '2026-08-17',
        operator_id: 41,
        operator_name: 'Kateryna Antonova',
        client_id: 230114,
        client_name: 'Smith Alice',
        debt_id: 7,
        contract_number: 'A-1',
        amount: '2500',
        payment_confirmation_date: '2026-08-18',
        status: 'verified',
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  },
}))
// Filter-aware mock: picking an operator simulates the keepPreviousData
// window (the previous rows are still in `data` while `isFetching` is true);
// "last_7d" simulates a SETTLED empty response.
vi.mock('@/features/training/hooks/useSuccessfulClosures', () => ({
  useSuccessfulClosures: (filters: { user_ids?: number[]; period?: string }) => {
    if (filters.user_ids != null) {
      return { ...closuresMock, isFetching: true }
    }
    if (filters.period === 'last_7d') {
      return {
        ...closuresMock,
        data: { ...closuresMock.data, items: [], total: 0 },
      }
    }
    return closuresMock
  },
}))

import { SuccessfulClosuresSubTab } from '../SuccessfulClosuresSubTab'

describe('SuccessfulClosuresSubTab — filter change UX', () => {
  it('renders the settled rows without an overlay on the default filters', () => {
    render(<SuccessfulClosuresSubTab />)
    expect(screen.getByText('A-1')).toBeInTheDocument()
    expect(screen.queryByTestId('analytics-table-overlay')).not.toBeInTheDocument()
  })

  it('shows the refetch overlay over the kept rows when the operator filter changes', () => {
    render(<SuccessfulClosuresSubTab />)
    const [operatorSelect] = Array.from(document.querySelectorAll('select'))
    fireEvent.change(operatorSelect, { target: { value: 'Kateryna Antonova' } })

    // The refetch is in flight: the kept (previous) rows are still rendered…
    expect(screen.getByText('A-1')).toBeInTheDocument()
    // …but the table is explicitly marked as updating instead of silently
    // showing the previous manager's data.
    const overlay = screen.getByTestId('analytics-table-overlay')
    expect(overlay).toBeInTheDocument()
    expect(screen.getByText('pages.training.actionAnalysis.updating')).toBeInTheDocument()
    expect(overlay.closest('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows the empty state (not the previous rows) when the filtered result is empty', () => {
    render(<SuccessfulClosuresSubTab />)
    expect(screen.getByText('A-1')).toBeInTheDocument()

    fireEvent.click(screen.getByText('pages.training.period.7days'))

    expect(screen.getByText('pages.training.closures.empty')).toBeInTheDocument()
    expect(screen.queryByText('A-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analytics-table-overlay')).not.toBeInTheDocument()
  })
})
