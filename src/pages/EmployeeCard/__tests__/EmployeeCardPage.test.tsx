import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const state = vi.hoisted(() => ({
  card: null as EmployeeCard | null,
  isLoading: false,
  isError: false,
  askedFor: undefined as unknown,
  neighbours: undefined as unknown,
  neighboursQuery: undefined as unknown,
}))

vi.mock('@/features/employeeCard/hooks/useEmployeeCard', () => ({
  useEmployeeCard: (userId: number, projectId?: number | null) => {
    state.askedFor = { userId, projectId }
    return { data: state.card, isLoading: state.isLoading, isError: state.isError }
  },
  useCardNeighbours: (userId: number, listQuery: string) => {
    state.neighboursQuery = { userId, listQuery }
    return { data: state.neighbours }
  },
}))

vi.mock('@/features/employeeCard', () => ({
  ChronologySection: ({ userId }: { userId: number }) => (
    <div data-testid="chronology">chronology for {userId}</div>
  ),
}))

vi.mock('@/lib/avatarImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/avatarImage')>()
  return { ...actual, loadAvatarObjectUrl: vi.fn(() => new Promise(() => {})) }
})

const { EmployeeCardPage } = await import('../EmployeeCardPage')

function card(overrides: Partial<EmployeeCard> = {}): EmployeeCard {
  return {
    header: {
      id: 7,
      full_name: 'Olena Kovalchuk',
      last_name: 'Kovalchuk',
      first_name: 'Olena',
      middle_name: null,
      status: 'active',
      work_format: 'remote',
      avatar_url: null,
      phone: '+380 67 123 45 67',
      email: 'olena@prionex.com',
      position: 'Senior Operator',
      department: 'Collection Department',
      manager: 'Serhiy Lytvyn',
      manager_user_id: 9,
      hired_at: '2024-03-15',
      telegram: '@olena',
    },
    personal: {
      date_of_birth: null,
      telegram: '@olena',
      city: 'Kyiv',
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
    },
    work: {
      project_id: 3,
      project_name: 'Technofinance',
      department: 'Collection Department',
      department_id: 1,
      position: 'Senior Operator',
      role_id: 2,
      manager: 'Serhiy Lytvyn',
      hired_at: '2024-03-15',
    },
    contacts: [],
    children: [],
    additional: { military_status: null, visa_status: null, educations: [], languages: [] },
    documents: [],
    surveys: [],
    interview_comment: null,
    can_edit: false,
    ...overrides,
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/team-management/users/:userId" element={<EmployeeCardPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EmployeeCardPage', () => {
  beforeEach(() => {
    state.card = card()
    state.isLoading = false
    state.isError = false
    state.askedFor = undefined
    state.neighbours = undefined
    state.neighboursQuery = undefined
  })

  it('reads the employee from the address', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(state.askedFor).toEqual({ userId: 7, projectId: null })
  })

  it('carries the project the list was filtered by', () => {
    renderAt('/dashboard/team-management/users/7?project_id=3&status=active')

    expect(state.askedFor).toEqual({ userId: 7, projectId: 3 })
  })

  it('sends the reader back to the list they came from', () => {
    renderAt('/dashboard/team-management/users/7?project_id=3&status=active')

    const back = screen.getByRole('link', { name: 'pages.employeeCard.backToList' })
    expect(back).toHaveAttribute(
      'href',
      '/dashboard/team-management/users?project_id=3&status=active'
    )
  })

  it('shows whose card this is', () => {
    renderAt('/dashboard/team-management/users/7')

    const panel = screen.getByRole('complementary')
    expect(within(panel).getByRole('heading', { name: 'Olena Kovalchuk' })).toBeInTheDocument()
    expect(within(panel).getByText('Senior Operator')).toBeInTheDocument()
    expect(within(panel).getByText('Serhiy Lytvyn')).toBeInTheDocument()
  })

  it('shows the sections the card is made of', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(
      screen.getByRole('heading', { name: 'pages.employeeCard.sections.personal-information' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'pages.employeeCard.sections.work-information' })
    ).toBeInTheDocument()
    expect(screen.getByText('Kyiv')).toBeInTheDocument()
  })

  it('says a field is empty rather than leaving a gap', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getAllByText('pages.employeeCard.notFilledIn').length).toBeGreaterThan(0)
  })

  it('offers no edit action to somebody who may only read', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(
      screen.queryByRole('button', { name: 'pages.employeeCard.edit' })
    ).not.toBeInTheDocument()
  })

  it('offers a tab for every section', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getAllByRole('tab')).toHaveLength(7)
  })

  it('mounts the chronology for this employee', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByTestId('chronology')).toHaveTextContent('chronology for 7')
  })

  it('offers a way to write to them and to open Telegram', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(
      screen.getByRole('link', { name: 'pages.employeeCard.panel.writeEmail' })
    ).toHaveAttribute('href', 'mailto:olena@prionex.com')
    expect(
      screen.getByRole('link', { name: 'pages.employeeCard.panel.openTelegram' })
    ).toHaveAttribute('href', 'https://t.me/olena')
  })

  it('leaves out a quick action it has no address for', () => {
    state.card = card({
      header: { ...card().header, telegram: null, email: null },
    })

    renderAt('/dashboard/team-management/users/7')

    expect(
      screen.queryByRole('link', { name: 'pages.employeeCard.panel.openTelegram' })
    ).not.toBeInTheDocument()
  })

  it('reports a failure instead of an empty card', () => {
    state.card = null
    state.isError = true

    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByRole('alert')).toHaveTextContent('pages.employeeCard.failed')
  })

  it('refuses an address that is not an employee id', () => {
    renderAt('/dashboard/team-management/users/not-a-number')

    expect(screen.getByText('pages.employeeCard.notFound')).toBeInTheDocument()
  })
})

describe('EmployeeCardPage navigation', () => {
  beforeEach(() => {
    state.card = card()
    state.isLoading = false
    state.isError = false
    state.neighbours = {
      position: 3,
      total: 247,
      previous_user_id: 6,
      next_user_id: 8,
    }
  })

  it('asks for the neighbours in the list the reader came from', () => {
    renderAt('/dashboard/team-management/users/7?project_id=3&status=active')

    expect(state.neighboursQuery).toEqual({
      userId: 7,
      listQuery: 'project_id=3&status=active',
    })
  })

  it('says where in the list this employee sits', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByText('pages.employeeCard.position')).toBeInTheDocument()
  })

  it('walks to either side without losing the filters', () => {
    renderAt('/dashboard/team-management/users/7?project_id=3')

    expect(
      screen.getByRole('link', { name: 'pages.employeeCard.previousEmployee' })
    ).toHaveAttribute('href', '/dashboard/team-management/users/6?project_id=3')
    expect(screen.getByRole('link', { name: 'pages.employeeCard.nextEmployee' })).toHaveAttribute(
      'href',
      '/dashboard/team-management/users/8?project_id=3'
    )
  })

  it('offers nothing to click at the end of the list', () => {
    state.neighbours = {
      position: 247,
      total: 247,
      previous_user_id: 6,
      next_user_id: null,
    }

    renderAt('/dashboard/team-management/users/7')

    expect(screen.getByRole('button', { name: 'pages.employeeCard.nextEmployee' })).toBeDisabled()
  })

  it('shows no position for somebody the list does not contain', () => {
    state.neighbours = {
      position: null,
      total: 247,
      previous_user_id: null,
      next_user_id: null,
    }

    renderAt('/dashboard/team-management/users/7')

    expect(screen.queryByText('pages.employeeCard.position')).not.toBeInTheDocument()
  })
})

/*
 * These assert classes rather than rendered geometry, because jsdom lays
 * nothing out: it reports every element as zero by zero, so "does it stay put
 * when scrolled" cannot be observed here. What can be pinned is the intent -
 * and the failure they exist for is a quiet one. The panel was already marked
 * sticky and did nothing, because a grid item stretches to its row by default
 * and something already as tall as its neighbour has nowhere to slide. Nothing
 * throws, nothing looks broken in a screenshot taken at the top of the page;
 * it only shows when somebody scrolls.
 */
describe('EmployeeCardPage: what stays on screen while the sections scroll', () => {
  beforeEach(() => {
    state.card = card()
    state.isLoading = false
    state.isError = false
    state.neighbours = { position: 3, total: 247, previous_user_id: 6, next_user_id: 8 }
  })

  it('keeps the panel and the way back on screen together', () => {
    renderAt('/dashboard/team-management/users/7')

    const panel = screen.getByRole('complementary')
    const back = screen.getByRole('link', { name: 'pages.employeeCard.backToList' })

    const column = panel.closest('.sticky')
    expect(column).not.toBeNull()
    expect(column).toContainElement(back)
  })

  it('sizes the left column to its contents rather than to the row', () => {
    renderAt('/dashboard/team-management/users/7')

    const grid = screen.getByRole('complementary').closest('.grid')
    expect(grid?.className).toContain('items-start')
  })

  /*
   * The one that actually mattered. ``main`` in DashboardLayout has
   * ``overflow-y-auto`` with only ``min-h-screen``, so it grows rather than
   * scrolls - and an ancestor with overflow is what sticky measures against
   * whether or not it ever scrolls. Inside it, sticky is inert at every
   * offset. The card has to bring a container that really does scroll, and
   * both blocks have to be inside it.
   */
  it('scrolls inside its own container, which is what sticky needs', () => {
    renderAt('/dashboard/team-management/users/7')

    const tabs = screen.getByRole('tablist', { name: 'pages.employeeCard.sectionNav' })
    const header = tabs.closest('.sticky') as HTMLElement
    const column = screen.getByRole('complementary').closest('.sticky') as HTMLElement

    const scroller = header.closest('.overflow-y-auto')
    expect(scroller).not.toBeNull()
    expect(scroller).toContainElement(column)
    expect(scroller?.className).toMatch(/h-\[calc\(100vh-\d+px\)\]/)
  })

  /*
   * The reason the last tabs looked dead: the click scrolled, the container
   * was already at its end, and the section stopped short of the header.
   */
  it('leaves room after the last section for its own tab to reach the header', () => {
    renderAt('/dashboard/team-management/users/7')

    const chronology = document.getElementById('chronology') as HTMLElement
    const tail = chronology.nextElementSibling as HTMLElement

    expect(tail).not.toBeNull()
    expect(tail.getAttribute('aria-hidden')).toBe('true')
    expect(tail.style.height).not.toBe('')
  })

  it('scrolls without showing a bar of its own', () => {
    renderAt('/dashboard/team-management/users/7')

    const tabs = screen.getByRole('tablist', { name: 'pages.employeeCard.sectionNav' })
    const scroller = tabs.closest('.overflow-y-auto') as HTMLElement

    expect(scroller.className).toContain('[scrollbar-width:none]')
    expect(scroller.className).toContain('[&::-webkit-scrollbar]:hidden')
  })

  it('pins both blocks to the top of that container, at the same height', () => {
    renderAt('/dashboard/team-management/users/7')

    const tabs = screen.getByRole('tablist', { name: 'pages.employeeCard.sectionNav' })
    const header = tabs.closest('.sticky') as HTMLElement
    const column = screen.getByRole('complementary').closest('.sticky') as HTMLElement

    expect(header.className).toContain('top-0')
    expect(column.className).toContain('top-0')
  })

  it('sets no height on the panel, so it is as tall as what it holds', () => {
    renderAt('/dashboard/team-management/users/7')

    const panel = screen.getByRole('complementary')
    expect(panel.className).not.toMatch(/\bh-(?!auto)/)
    expect(panel.style.height).toBe('')
  })

  /*
   * The app header is fixed and must stay over everything: a card header that
   * outranked it would slide over the search bar instead of under it.
   */
  it('stacks the card header under the app header, not over it', () => {
    renderAt('/dashboard/team-management/users/7')

    const tabs = screen.getByRole('tablist', { name: 'pages.employeeCard.sectionNav' })
    expect((tabs.closest('.sticky') as HTMLElement).className).toContain('z-10')
  })

  it('keeps walking the list and choosing a section together in one sticky block', () => {
    renderAt('/dashboard/team-management/users/7')

    const tabs = screen.getByRole('tablist', { name: 'pages.employeeCard.sectionNav' })
    const previous = screen.getByRole('link', { name: 'pages.employeeCard.previousEmployee' })

    const header = tabs.closest('.sticky')
    expect(header).not.toBeNull()
    expect(header).toContainElement(previous)
  })

  /*
   * One block, not two stacked sticky elements: the tabs would otherwise have
   * to carry the height of the row above them as an offset, and be wrong the
   * moment that row wraps.
   */
  it('does not leave the tabs sticking on their own', () => {
    renderAt('/dashboard/team-management/users/7')

    const tabs = screen.getByRole('tablist', { name: 'pages.employeeCard.sectionNav' })
    expect(tabs.className).not.toContain('sticky')
  })

  it('spreads the walk controls across the header rather than bunching them', () => {
    renderAt('/dashboard/team-management/users/7')

    const previous = screen.getByRole('link', { name: 'pages.employeeCard.previousEmployee' })
    expect(previous.parentElement?.className).toContain('justify-between')
  })

  it('leaves the way back over the panel, not among the walk controls', () => {
    renderAt('/dashboard/team-management/users/7')

    const back = screen.getByRole('link', { name: 'pages.employeeCard.backToList' })
    const previous = screen.getByRole('link', { name: 'pages.employeeCard.previousEmployee' })

    // Both stay on screen, in different blocks: leaving is about the list, and
    // Previous/Next is about the sections it sits over.
    expect(back.parentElement).not.toBe(previous.parentElement)
    expect(back.closest('.sticky')).not.toBe(previous.closest('.sticky'))
  })
})
