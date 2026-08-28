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

/*
 * The history is paged, so a period has to be asked of the server. Trimming
 * what has already arrived would narrow one page and leave the rest of the
 * period sitting unread behind a "show earlier" button.
 */
/** Open the period control, which the two dates now live behind. */
async function openPeriod() {
  await userEvent.click(
    screen.getByRole('button', { name: 'pages.employeeCard.chronology.selectPeriod' })
  )
}

describe('ChronologySection: narrowing to a period', () => {
  beforeEach(() => {
    state.events = [event()]
    state.isLoading = false
    state.isError = false
    state.lastQuery = undefined
  })

  it('asks the server for the period rather than filtering what it already has', async () => {
    render(<ChronologySection userId={7} />)

    await openPeriod()
    await userEvent.type(
      screen.getByPlaceholderText('pages.employeeCard.chronology.from'),
      '01.01.2024'
    )

    expect(state.lastQuery).toMatchObject({ occurred_from: '2024-01-01T00:00:00' })
  })

  /*
   * The end of the day, not its start: somebody picking today means the
   * events that happened today, and midnight would exclude every one of them.
   */
  it('takes the end of the day as the end of the period', async () => {
    render(<ChronologySection userId={7} />)

    await openPeriod()
    await userEvent.type(
      screen.getByPlaceholderText('pages.employeeCard.chronology.to'),
      '31.12.2024'
    )

    expect(state.lastQuery).toMatchObject({ occurred_to: '2024-12-31T23:59:59' })
  })

  it('asks for no period at all until one is chosen', () => {
    render(<ChronologySection userId={7} />)

    expect(state.lastQuery).not.toHaveProperty('occurred_from')
    expect(state.lastQuery).not.toHaveProperty('occurred_to')
  })

  it('keeps the category alongside the period', async () => {
    render(<ChronologySection userId={7} />)

    await userEvent.click(
      screen.getByRole('tab', { name: 'pages.employeeCard.chronology.filters.training' })
    )
    await openPeriod()
    await userEvent.type(
      screen.getByPlaceholderText('pages.employeeCard.chronology.from'),
      '01.01.2024'
    )

    expect(state.lastQuery).toMatchObject({
      category: 'training',
      occurred_from: '2024-01-01T00:00:00',
    })
  })
})

describe('ChronologySection: folding a year away', () => {
  beforeEach(() => {
    state.events = [
      event({ id: 1, occurred_at: '2026-08-28T00:00:00Z' }),
      event({ id: 2, occurred_at: '2024-03-15T00:00:00Z' }),
    ]
    state.isLoading = false
    state.isError = false
  })

  it('opens every year it has not been told to close', () => {
    render(<ChronologySection userId={7} />)

    for (const year of ['2026', '2024']) {
      expect(screen.getByRole('button', { name: year })).toHaveAttribute('aria-expanded', 'true')
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('hides a year’s events when it is folded', async () => {
    render(<ChronologySection userId={7} />)

    await userEvent.click(screen.getByRole('button', { name: '2026' }))

    expect(screen.getByRole('button', { name: '2026' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('leaves the other years alone', async () => {
    render(<ChronologySection userId={7} />)

    await userEvent.click(screen.getByRole('button', { name: '2026' }))

    expect(screen.getByRole('button', { name: '2024' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens a folded year again when it is clicked twice', async () => {
    render(<ChronologySection userId={7} />)

    const year = screen.getByRole('button', { name: '2026' })
    await userEvent.click(year)
    await userEvent.click(screen.getByRole('button', { name: '2026' }))

    expect(screen.getByRole('button', { name: '2026' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  /*
   * The rail is its own element, not a border on the box: a border runs the
   * full height and left a stub of line above the first year with nothing at
   * its end.
   */
  it('starts and stops the rail at the markers rather than at the edges', () => {
    const { container } = render(<ChronologySection userId={7} />)

    const rail = container.querySelector('.border-dashed') as HTMLElement
    expect(rail).not.toBeNull()
    expect(rail.className).toContain('top-3')
    expect(rail.className).toContain('bottom-3')
    expect(rail.parentElement?.className).not.toContain('border-dashed')
  })
})

/*
 * The header carries a title, four filters and a period control. The two date
 * fields used to sit there open, taking a third of the width for something
 * most readers never set.
 */
describe('ChronologySection: the header controls', () => {
  beforeEach(() => {
    state.events = [event()]
    state.isLoading = false
    state.isError = false
  })

  it('keeps the dates behind one control until they are wanted', () => {
    render(<ChronologySection userId={7} />)

    expect(screen.queryByPlaceholderText('pages.employeeCard.chronology.from')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'pages.employeeCard.chronology.selectPeriod' })
    ).toBeInTheDocument()
  })

  it('says which period is set once one is', async () => {
    render(<ChronologySection userId={7} />)

    await openPeriod()
    await userEvent.type(
      screen.getByPlaceholderText('pages.employeeCard.chronology.from'),
      '01.01.2024'
    )

    expect(
      screen.queryByRole('button', { name: 'pages.employeeCard.chronology.selectPeriod' })
    ).toBeNull()
  })

  /*
   * The picker's calendar renders inside the panel rather than in a portal, so
   * a click on a day is a click inside. Closing on any outside click would
   * shut the panel the moment somebody picked a date.
   */
  it('stays open while a date is being picked', async () => {
    render(<ChronologySection userId={7} />)

    await openPeriod()
    await userEvent.click(screen.getByPlaceholderText('pages.employeeCard.chronology.from'))

    // By name: the picker's own popup is a dialog too, so a bare role query
    // matches two and says nothing about which one survived.
    expect(
      screen.getByRole('dialog', { name: 'pages.employeeCard.chronology.selectPeriod' })
    ).toBeInTheDocument()
  })

  it('closes when the reader clicks away', async () => {
    render(<ChronologySection userId={7} />)

    await openPeriod()
    await userEvent.click(document.body)

    expect(
      screen.queryByRole('dialog', { name: 'pages.employeeCard.chronology.selectPeriod' })
    ).toBeNull()
  })

  it('lays the filters out as separate pills rather than one bar', () => {
    render(<ChronologySection userId={7} />)

    const tabs = screen.getByRole('tablist', {
      name: 'pages.employeeCard.chronology.filterLabel',
    })

    expect(tabs.className).not.toContain('bg-card')
    expect(tabs.className).not.toContain('shadow-sm')
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('rounded-full')
    }
  })
})
