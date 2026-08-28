/**
 * Saving the personal section has to reach past the card.
 *
 * That section writes the employee's own record, not just the profile beside
 * it, and name, phone, email and work format are all columns in the employees
 * list. Without marking the list stale, somebody corrects a misspelled name on
 * the card, goes back, and the list still shows the old one.
 */

import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usersKeys } from '@/features/users/hooks/useUsers'

const updatePersonal = vi.hoisted(() => vi.fn())
const removeSurvey = vi.hoisted(() => vi.fn())

vi.mock('../api/employeeCardApi', () => ({ updatePersonal, removeSurvey }))

const { useUpdatePersonal, useRemoveSurvey, employeeCardKeys } =
  await import('../hooks/useEmployeeCard')

function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

describe('useUpdatePersonal', () => {
  it('marks the employees list stale, because the name on it just changed', async () => {
    const { client, wrapper } = harness()
    client.setQueryData(usersKeys.lists(), { users: [] })
    updatePersonal.mockResolvedValue({ header: { id: 7 } })

    const { result } = renderHook(() => useUpdatePersonal(7, null), { wrapper })
    await result.current.mutateAsync({ last_name: 'Kovalenko' })

    await waitFor(() => expect(client.getQueryState(usersKeys.lists())?.isInvalidated).toBe(true))
  })

  it('puts the answer straight into the card rather than refetching it', async () => {
    const { client, wrapper } = harness()
    const saved = { header: { id: 7, full_name: 'Kovalenko Olena' } }
    updatePersonal.mockResolvedValue(saved)

    const { result } = renderHook(() => useUpdatePersonal(7, null), { wrapper })
    await result.current.mutateAsync({ last_name: 'Kovalenko' })

    expect(client.getQueryData(employeeCardKeys.one(7, null))).toEqual(saved)
  })
})

/*
 * Removing a survey takes its chronology line with it, and the timeline is a
 * separate query - so the card coming back is not enough to stop the removed
 * answer still showing in the history below.
 */
describe('useRemoveSurvey', () => {
  it('refreshes the chronology the answer was on', async () => {
    const { client, wrapper } = harness()
    removeSurvey.mockResolvedValue({ header: { id: 7 } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveSurvey(7, null), { wrapper })
    await result.current.mutateAsync(11)

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['employee-events'] }))
  })

  it('puts the card it answers with straight into the cache', async () => {
    const { client, wrapper } = harness()
    const saved = { header: { id: 7 }, surveys: [] }
    removeSurvey.mockResolvedValue(saved)

    const { result } = renderHook(() => useRemoveSurvey(7, null), { wrapper })
    await result.current.mutateAsync(11)

    expect(client.getQueryData(employeeCardKeys.one(7, null))).toEqual(saved)
  })
})
