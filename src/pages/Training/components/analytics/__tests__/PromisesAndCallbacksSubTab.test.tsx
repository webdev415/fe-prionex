/**
 * Filter-UX coverage for PromisesAndCallbacksSubTab (KAN-1027/KAN-1029 UX
 * follow-up). The list hook keeps previous data on a filter change
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

const promisesMock = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  isFetching: false,
  data: {
    summary_cards: {
      total_promises_amount: '1200',
      paid_amount: '500',
      overdue_count: 0,
      pending_amount: '700',
    },
    items: [
      {
        id: 1,
        interaction_date: '2026-08-17T09:30:00',
        client_id: 230114,
        client_full_name: 'Smith Alice',
        phone_used: null,
        user_id: 41,
        user_name: 'Kateryna Antonova',
        contact_type_id: null,
        contact_type_name: null,
        contact_type_code: null,
        result_id: null,
        result_name: null,
        result_code: null,
        promise_to_pay_amount: '1200',
        promise_to_pay_date: '2026-08-20',
        next_action_date: null,
        follow_up_date: null,
        channel: null,
        current_responsible_user_id: null,
        current_responsible_user_name: null,
        summary: null,
        debt_id: null,
        contract_number: 'A-1',
        promise_fulfilled: null,
        payment_term_date: '2026-08-20',
        status: 'pending',
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  },
}))
// Filter-aware mock: "yesterday" simulates the keepPreviousData window (the
// previous period's rows are still in `data` while `isFetching` is true);
// "last_7d" simulates a SETTLED empty response.
vi.mock('@/features/training/hooks/usePromisesAndCallbacks', () => ({
  usePromisesAndCallbacks: (filters: { period?: string }) => {
    if (filters.period === 'yesterday') {
      return { ...promisesMock, isFetching: true }
    }
    if (filters.period === 'last_7d') {
      return {
        ...promisesMock,
        data: { ...promisesMock.data, items: [], total: 0 },
      }
    }
    return promisesMock
  },
}))

import { PromisesAndCallbacksSubTab } from '../PromisesAndCallbacksSubTab'

describe('PromisesAndCallbacksSubTab — filter change UX', () => {
  it('renders the settled rows without an overlay on the default period', () => {
    render(<PromisesAndCallbacksSubTab />)
    expect(screen.getByText('Kateryna Antonova')).toBeInTheDocument()
    expect(screen.queryByTestId('analytics-table-overlay')).not.toBeInTheDocument()
  })

  it('shows the refetch overlay over the kept rows when the period filter changes', () => {
    render(<PromisesAndCallbacksSubTab />)
    fireEvent.click(screen.getByText('pages.training.period.yesterday'))

    // The refetch is in flight: the kept (previous) rows are still rendered…
    expect(screen.getByText('Kateryna Antonova')).toBeInTheDocument()
    // …but the table is explicitly marked as updating instead of silently
    // showing the previous period's data.
    const overlay = screen.getByTestId('analytics-table-overlay')
    expect(overlay).toBeInTheDocument()
    expect(screen.getByText('pages.training.actionAnalysis.updating')).toBeInTheDocument()
    expect(overlay.closest('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows the empty state (not the previous rows) when the filtered result is empty', () => {
    render(<PromisesAndCallbacksSubTab />)
    expect(screen.getByText('Kateryna Antonova')).toBeInTheDocument()

    fireEvent.click(screen.getByText('pages.training.period.7days'))

    expect(screen.getByText('pages.training.promises.empty')).toBeInTheDocument()
    expect(screen.queryByText('Kateryna Antonova')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analytics-table-overlay')).not.toBeInTheDocument()
  })
})
