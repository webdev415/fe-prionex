import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeEvent } from '../types'

const state = vi.hoisted(() => ({
  events: [] as EmployeeEvent[],
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  lastQuery: undefined as unknown,
}))

vi.mock('../hooks/useEmployeeEvents', () => ({
  useEmployeeEvents: (_userId: number, query: unknown) => {
    state.lastQuery = query
    return {
      data: { pages: [{ events: state.events, next_cursor: null, has_more: false }] },
      isLoading: state.isLoading,
      isError: state.isError,
      hasNextPage: state.hasNextPage,
      isFetchingNextPage: state.isFetchingNextPage,
      fetchNextPage: state.fetchNextPage,
    }
  },
}))

const { ChronologySection } = await import('../components/ChronologySection')

function event(overrides: Partial<EmployeeEvent> = {}): EmployeeEvent {
  return {
    id: 1,
    category: 'personnel',
    event_type: 'hired',
    occurred_at: '2024-03-15T00:00:00Z',
    project_id: 3,
    payload: {},
    ...overrides,
  }
}

describe('ChronologySection', () => {
  beforeEach(() => {
    state.events = []
    state.isLoading = false
    state.isError = false
    state.hasNextPage = false
    state.isFetchingNextPage = false
    state.fetchNextPage = vi.fn()
    state.lastQuery = undefined
  })

  it('groups what it shows under the year it happened in', () => {
    state.events = [
      event({ id: 1, occurred_at: '2025-09-01T00:00:00Z', event_type: 'role_changed' }),
      event({ id: 2, occurred_at: '2024-03-15T00:00:00Z' }),
    ]

    render(<ChronologySection userId={7} />)

    expect(screen.getByRole('heading', { name: '2025' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2024' })).toBeInTheDocument()
  })

  it('puts each event under its own year and not the other', () => {
    state.events = [
      event({ id: 1, occurred_at: '2025-09-01T00:00:00Z', event_type: 'role_changed' }),
      event({ id: 2, occurred_at: '2024-03-15T00:00:00Z' }),
    ]

    render(<ChronologySection userId={7} />)

    const lists = screen.getAllByRole('list')
    expect(within(lists[0]).getByText('role_changed')).toBeInTheDocument()
    expect(within(lists[1]).getByText('hired')).toBeInTheDocument()
  })

  it('asks for everything until a filter is chosen', () => {
    render(<ChronologySection userId={7} />)

    expect(state.lastQuery).toEqual({})
  })

  it('asks the server for the category the reader picked', async () => {
    const user = userEvent.setup()
    render(<ChronologySection userId={7} />)

    await user.click(
      screen.getByRole('tab', { name: 'pages.employeeCard.chronology.filters.personnel' })
    )

    expect(state.lastQuery).toEqual({ category: 'personnel' })
  })

  it('says so when there is nothing to show', () => {
    render(<ChronologySection userId={7} />)

    expect(screen.getByText('pages.employeeCard.chronology.empty')).toBeInTheDocument()
  })

  it('reports a failure instead of looking empty', () => {
    state.isError = true

    render(<ChronologySection userId={7} />)

    expect(screen.getByRole('alert')).toHaveTextContent('pages.employeeCard.chronology.failed')
    expect(screen.queryByText('pages.employeeCard.chronology.empty')).not.toBeInTheDocument()
  })

  it('offers the earlier pages only while there are some', async () => {
    state.events = [event()]
    const { unmount } = render(<ChronologySection userId={7} />)

    expect(
      screen.queryByRole('button', { name: 'pages.employeeCard.chronology.loadMore' })
    ).not.toBeInTheDocument()
    unmount()

    state.hasNextPage = true
    render(<ChronologySection userId={7} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'pages.employeeCard.chronology.loadMore' }))

    expect(state.fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('does not ask twice while a page is already on its way', () => {
    state.events = [event()]
    state.hasNextPage = true
    state.isFetchingNextPage = true

    render(<ChronologySection userId={7} />)

    expect(
      screen.getByRole('button', { name: 'pages.employeeCard.chronology.loadMore' })
    ).toBeDisabled()
  })
})
