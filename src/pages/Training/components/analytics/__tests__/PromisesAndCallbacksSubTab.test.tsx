/**
 * Filter-UX coverage for PromisesAndCallbacksSubTab (KAN-1027/KAN-1029 UX
 * follow-up). The list hook keeps previous data on a filter change
 * (`placeholderData: keepPreviousData`), so the table must:
 *   1) show an explicit refetch overlay while the new request is in flight
 *      (instead of silently presenting the previous filter's rows), and
 *   2) show the empty state — not stale rows — once an empty page settles.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

// Two operators share a full name on purpose: the picker used to send the
// LABEL and resolve it back through a name→id map, which silently collapsed a
// duplicate pair onto one id. The options must carry distinct ids.
//
// None of these names is the row's operator ("Kateryna Antonova"): the option
// list and the table share one DOM, so a name in both would make the existing
// `getByText` assertions below ambiguous rather than meaningful.
const operatorsMock = vi.hoisted(() => ({
  data: [
    { id: 41, full_name: 'Olena Kovalenko', department_name: 'Hard Collection' },
    { id: 51, full_name: 'Bohdan Melnyk', department_name: 'Soft Collection' },
    { id: 77, full_name: 'Bohdan Melnyk', department_name: 'Legal' },
  ],
}))
vi.mock('@/features/users/hooks', () => ({
  useOperators: () => operatorsMock,
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
// Every filter object the component asks with, in order — this is how the
// "operator filter is ignored" regression is pinned: the assertion is that
// `user_ids` actually reaches the query.
const askedWith = vi.hoisted(() => [] as Array<Record<string, unknown>>)

vi.mock('@/features/training/hooks/usePromisesAndCallbacks', () => ({
  usePromisesAndCallbacks: (filters: { period?: string }) => {
    askedWith.push(filters as Record<string, unknown>)
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

describe('PromisesAndCallbacksSubTab — operator filter', () => {
  beforeEach(() => {
    askedWith.length = 0
  })

  function operatorSelect(): HTMLSelectElement {
    return screen.getByLabelText('pages.training.promises.filters.operator') as HTMLSelectElement
  }

  it('offers every operator of the project', () => {
    render(<PromisesAndCallbacksSubTab />)
    const options = Array.from(operatorSelect().options).map((o) => o.value)
    expect(options).toEqual(['all', '41', '51', '77'])
  })

  it('asks for no operator scope until one is picked', () => {
    render(<PromisesAndCallbacksSubTab />)
    expect(askedWith.at(-1)?.user_ids).toBeUndefined()
  })

  it('sends the picked operator as user_ids — the reported regression', () => {
    render(<PromisesAndCallbacksSubTab />)

    fireEvent.change(operatorSelect(), { target: { value: '41' } })

    expect(askedWith.at(-1)?.user_ids).toEqual([41])
  })

  it('distinguishes two operators who share a full name', () => {
    render(<PromisesAndCallbacksSubTab />)

    fireEvent.change(operatorSelect(), { target: { value: '77' } })

    // The option value is the id, so the second "Bohdan Melnyk" is reachable.
    // Keyed by label, both options carried the same string and the filter
    // resolved to whichever id the map happened to keep.
    expect(askedWith.at(-1)?.user_ids).toEqual([77])
  })

  it('returns to the unscoped query when the operator is cleared', () => {
    render(<PromisesAndCallbacksSubTab />)
    fireEvent.change(operatorSelect(), { target: { value: '51' } })
    expect(askedWith.at(-1)?.user_ids).toEqual([51])

    fireEvent.change(operatorSelect(), { target: { value: 'all' } })

    expect(askedWith.at(-1)?.user_ids).toBeUndefined()
  })

  it('resets to the first page when the operator changes', () => {
    render(<PromisesAndCallbacksSubTab />)

    fireEvent.change(operatorSelect(), { target: { value: '41' } })

    // A stale offset would page past the end of a smaller filtered set.
    expect(askedWith.at(-1)?.page).toBe(1)
  })
})

describe('PromisesAndCallbacksSubTab — "paid" caveat', () => {
  it('states how "paid" is decided without requiring a hover', () => {
    render(<PromisesAndCallbacksSubTab />)

    // Business decision 2026-08-27 kept the approximation (a client who paid
    // ANYTHING in the period counts as paid, and the money columns show the
    // promised amount) on condition that the tab says so in the open. A
    // hover-only tooltip would not satisfy that, so this asserts the note is
    // rendered as ordinary text.
    expect(screen.getByText('pages.training.promises.paidCaveat')).toBeInTheDocument()
  })

  it('repeats the caveat on the Status column, where the approximation lands', () => {
    render(<PromisesAndCallbacksSubTab />)

    const statusHeader = screen.getByText('pages.training.promises.cols.status').closest('th')
    expect(statusHeader).toHaveAttribute('title', 'pages.training.promises.cols.statusHint')
  })
})
