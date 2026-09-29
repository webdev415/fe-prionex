/**
 * The Training page keeps its own copy of the TA History tab, mounted under its
 * own ScopeSelector, so the same leak was reachable there (KAN-1211).
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

vi.mock('@/features/training', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTaHistory: (filters: unknown, enabled?: boolean) => useTaHistory(filters, enabled),
}))
vi.mock('@/features/users/hooks', () => ({
  useOperators: () => ({
    data: [
      { id: 11, department_id: 1, first_name: 'Me', last_name: '' },
      { id: 22, department_id: 1, first_name: 'Colleague', last_name: '' },
      { id: 33, department_id: 2, first_name: 'Elsewhere', last_name: '' },
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

import { TaHistoryTab } from '../TaHistoryTab'

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/dashboard/action-analysis${search}`]}>
      <TaHistoryTab />
    </MemoryRouter>
  )
}

const enabledArg = () => useTaHistory.mock.calls.at(-1)?.[1]
const filtersArg = () =>
  useTaHistory.mock.calls.at(-1)?.[0] as { recorded_by_in?: number[] } | undefined

beforeEach(() => {
  useTaHistory.mockClear()
})

describe('TaHistoryTab — a filter left over from another tab', () => {
  it('shows my own records on "My actions", not an empty screen', () => {
    // The reported behaviour: the Employee picker is disabled here, so a
    // colleague left selected on "All actions" must be ignored outright.
    renderAt('?scope=my&employee_id=22')
    expect(enabledArg()).toBe(true)
    expect(filtersArg()?.recorded_by_in).toEqual([11])
  })

  it('asks for the same thing as it would with no filter at all', () => {
    renderAt('?scope=my&employee_id=22')
    const withStaleFilter = filtersArg()?.recorded_by_in
    useTaHistory.mockClear()
    renderAt('?scope=my')
    expect(withStaleFilter).toEqual(filtersArg()?.recorded_by_in)
  })

  it('never asks unfiltered, which would return every operator', () => {
    renderAt('?scope=my&employee_id=22')
    expect(filtersArg()?.recorded_by_in).not.toBeUndefined()
  })

  it('still honours the picker on "All actions", where it is usable', () => {
    renderAt('?scope=all&employee_id=22')
    expect(enabledArg()).toBe(true)
    expect(filtersArg()?.recorded_by_in).toEqual([22])
  })
})
