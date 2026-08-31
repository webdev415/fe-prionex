/**
 * Finding the client behind a number the CRM does not recognise.
 *
 * `interactions.client_id` is NOT NULL, so without this a call from an unknown
 * number can be written up nowhere at all — the operator would type it out and
 * be told only afterwards that it could not be saved.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { CallClientSearch } from '../CallClientSearch'

const searchClients = vi.fn()
vi.mock('@/api/clientSearchApi', () => ({
  searchClients: (...args: unknown[]) => searchClients(...args),
}))

const result = {
  id: 25,
  full_name: 'Кондратюк Наталія',
  first_name: 'Наталія',
  last_name: 'Кондратюк',
  phones: ['380971234567'],
  email_primary: null,
  tax_id: '1234567890',
  priority_score: 0,
  priority_level: 'low' as const,
  status: 'new',
  total_debt: '4000',
  debt_count: 1,
  primary_creditor: null,
}

describe('CallClientSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    searchClients.mockResolvedValue({ items: [result], total: 1, query: '', search_type: 'all' })
  })

  const type = (value: string) =>
    fireEvent.change(screen.getByRole('textbox'), { target: { value } })

  it('does not search on a fragment too short to mean anything', async () => {
    render(<CallClientSearch onSelect={vi.fn()} />)

    type('ко')

    await new Promise((resolve) => setTimeout(resolve, 400))
    // Two characters match most of the database and cost a round trip per
    // keystroke, mid-call.
    expect(searchClients).not.toHaveBeenCalled()
  })

  it('hands back the client the operator picked', async () => {
    const onSelect = vi.fn()
    render(<CallClientSearch onSelect={onSelect} />)

    type('кондратюк')

    fireEvent.click(await screen.findByText('Кондратюк Наталія'))
    expect(onSelect).toHaveBeenCalledWith(result)
  })

  it('ignores an answer that arrives after a newer search', async () => {
    render(<CallClientSearch onSelect={vi.fn()} />)
    let resolveSlow: (value: unknown) => void = () => {}
    searchClients.mockReturnValueOnce(new Promise((resolve) => (resolveSlow = resolve)))

    type('кондратюк')
    await waitFor(() => expect(searchClients).toHaveBeenCalledTimes(1))
    type('шевченко')
    await waitFor(() => expect(searchClients).toHaveBeenCalledTimes(2))

    // The operator is typing mid-call. A slow early answer landing on top of a
    // later one would offer the wrong client to attach the call to.
    resolveSlow({ items: [{ ...result, id: 99, full_name: 'Хтось Інший' }] })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByText('Хтось Інший')).toBeNull()
  })
})
