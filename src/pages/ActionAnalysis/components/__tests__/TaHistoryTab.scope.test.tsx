/**
 * TA History must not ask for records it is not allowed to show (KAN-1211).
 *
 * The unit tests on resolveTaHistoryUsers pin what the answer is. This pins the
 * consequence a pure test cannot see: when the answer is "nobody", the tab
 * issues **no request at all**. That matters because "nobody" and "no
 * restriction" both send no user filter — the only thing separating them is
 * whether the request happens.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const useTaHistory = vi.fn((_filters: unknown, _enabled?: boolean) => ({
  data: undefined,
  error: null,
  isPending: false,
}))

vi.mock('@/features/actionAnalysis', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTaHistory: (filters: unknown, enabled?: boolean) => useTaHistory(filters, enabled),
}))
vi.mock('@/features/users/hooks', () => ({
  useOperators: () => ({
    data: [
      { id: 11, department_id: 1, first_name: 'Me', last_name: '' },
      { id: 22, department_id: 1, first_name: 'Colleague', last_name: '' },
    ],
  }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({ useTAChains: () => ({ data: [] }) }))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: [] }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 11, active_department_id: 1, active_group_id: null } }),
}))

import TaHistoryTab from '../TaHistoryTab'

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/dashboard/action-analysis${search}`]}>
      <TaHistoryTab />
    </MemoryRouter>
  )
}

const enabledArg = () => useTaHistory.mock.calls.at(-1)?.[1]

beforeEach(() => {
  useTaHistory.mockClear()
})

describe('TaHistoryTab — the scope and the Employee filter disagree', () => {
  it('asks for nothing when "My actions" has a colleague selected', () => {
    // The reported bug: this used to run unfiltered and return every
    // employee's records.
    renderAt('?scope=my&employee_id=22')
    expect(enabledArg()).toBe(false)
  })

  it('asks normally when the selected employee is me', () => {
    renderAt('?scope=my&employee_id=11')
    expect(enabledArg()).toBe(true)
  })

  it('asks normally on "All actions" with a colleague selected', () => {
    renderAt('?scope=all&employee_id=22')
    expect(enabledArg()).toBe(true)
  })

  it('asks normally on "My actions" with no employee selected', () => {
    renderAt('?scope=my')
    expect(enabledArg()).toBe(true)
  })
})
