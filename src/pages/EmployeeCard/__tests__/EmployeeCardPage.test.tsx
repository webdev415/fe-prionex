import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const removeSurvey = vi.hoisted(() => vi.fn())

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
  useRemoveSurvey: () => ({ mutate: removeSurvey }),
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
      full_name: 'Kovalchuk Olena',
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
    termination: null,
    can_edit: false,
    ...overrides,
  }
}

/** The column holding the way back and the profile panel. */
function leftColumn(): HTMLElement {
  return screen.getByRole('complementary').parentElement as HTMLElement
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

  /*
   * The panel prints the given name first like the rest of the card, while the
   * monogram keeps the app's ordering - the same person should not be "CJ" in
   * the employees list and "JC" here.
   */
  it('names the employee the way the card reads, not the way the API sends it', () => {
    renderAt('/dashboard/team-management/users/7')

    const panel = screen.getByRole('complementary')
    expect(within(panel).getByRole('heading', { name: 'Olena Kovalchuk' })).toBeInTheDocument()
    expect(within(panel).queryByRole('heading', { name: 'Kovalchuk Olena' })).toBeNull()
  })

  it('shows whose card this is', () => {
    renderAt('/dashboard/team-management/users/7')

    const panel = screen.getByRole('complementary')
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

  it('marks a field with nothing in it rather than leaving a gap', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
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

  /*
   * The initials follow the heading under them rather than the API's
   * surname-first name - the card reads "James Chang", so the monogram is JC.
   * The two name parts are handed over separately, so a middle name or a
   * two-word surname cannot shuffle them.
   */
  it('reads the monogram in the same order as the name it sits above', () => {
    renderAt('/dashboard/team-management/users/7')

    const panel = screen.getByRole('complementary')
    expect(within(panel).getByText('OK')).toBeInTheDocument()
    expect(within(panel).queryByText('KO')).toBeNull()
  })

  /*
   * The panel carries no quick actions any more. The address is printed on it
   * a line above where the mail button was, so that one repeated what was
   * already there, and the Telegram one went with it.
   */
  /*
   * The rule belongs to what is under it. On somebody with no department,
   * manager, hire date or phone recorded - which is most people on a fresh
   * install - drawing it anyway leaves a line across the panel with nothing
   * beneath it.
   */
  it('rules off the details only when there are details', () => {
    renderAt('/dashboard/team-management/users/7')
    const panel = screen.getByRole('complementary')
    expect(panel.querySelector('.border-t')).not.toBeNull()

    state.card = card({
      header: {
        ...card().header,
        department: null,
        manager: null,
        hired_at: null,
        phone: null,
        email: null,
      },
    })
    renderAt('/dashboard/team-management/users/7')

    const bare = screen.getAllByRole('complementary')[1]
    expect(bare.querySelector('.border-t')).toBeNull()
  })

  it('gives each badge its own line', () => {
    renderAt('/dashboard/team-management/users/7')

    const panel = screen.getByRole('complementary')
    // One level, not two: the badge's parent is the row that holds both. Two
    // levels lands on the <aside>, which is itself flex-col and would say yes
    // whatever the row did.
    const badges = within(panel).getByText('pages.employeeCard.status.active').parentElement

    expect(badges?.className).toContain('flex-col')
    expect(badges?.className).not.toContain('flex-wrap')
  })

  /*
   * Where somebody works is a fact worth seeing at a glance, and the word
   * alone reads as another status pill beside the one above it.
   */
  it('marks the work format with an icon as well as a word', () => {
    renderAt('/dashboard/team-management/users/7')

    const panel = screen.getByRole('complementary')
    const badge = within(panel).getByText('pages.employeeCard.workFormat.remote').parentElement

    expect(badge?.querySelector('svg')).not.toBeNull()
  })

  it('carries no quick-action buttons', () => {
    const { container } = renderAt('/dashboard/team-management/users/7')

    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(container.querySelector('a[href^="https://t.me/"]')).toBeNull()
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

  /*
   * Only from ``lg``. Below that the two columns are stacked, and a panel
   * pinned to the top there would cover the sections it is meant to sit
   * beside - it would follow the reader down over its own card.
   */
  it('keeps the panel and the way back on screen together, once there are two columns', () => {
    renderAt('/dashboard/team-management/users/7')

    const back = screen.getByRole('link', { name: 'pages.employeeCard.backToList' })
    const column = leftColumn()

    expect(column).toContainElement(back)
    expect(column.className).toContain('lg:sticky')
    expect(column.className).not.toMatch(/(^|\s)sticky(\s|$)/)
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
    const column = leftColumn()

    const scroller = header.closest('.overflow-y-auto')
    expect(scroller).not.toBeNull()
    expect(scroller).toContainElement(column)
    expect(scroller?.className).toMatch(/h-\[calc\(100vh-\d+px\)\]/)
  })

  /*
   * A phone counts the address bar's space in ``100vh``, so the card would run
   * that far past the bottom of the screen and its last section could never be
   * reached.
   */
  it('measures the container in dvh where the browser has it', () => {
    renderAt('/dashboard/team-management/users/7')

    const tabs = screen.getByRole('tablist', { name: 'pages.employeeCard.sectionNav' })
    const scroller = tabs.closest('.overflow-y-auto') as HTMLElement

    expect(scroller.className).toContain('supports-[height:100dvh]:h-[calc(100dvh-104px)]')
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
    const bar = tabs.closest('.sticky') as HTMLElement

    expect(bar.className).toContain('top-0')
    expect(leftColumn().className).toContain('lg:top-0')
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
    const previous = screen.getByRole('link', { name: /pages.employeeCard.previousEmployee/ })

    const header = tabs.closest('.sticky')
    expect(header).not.toBeNull()
    expect(header).toContainElement(previous)
  })

  /*
   * ``neutral-dim`` and the light theme both define a dashboard background
   * image, so the right colour alone is not the page - it reads as a strip
   * laid over the card. The bar carries the page's own two background classes
   * instead, with fixed attachment so the image lines up rather than starting
   * over inside the bar.
   */
  it('wears the page background rather than one of its own', () => {
    renderAt('/dashboard/team-management/users/7')

    const tabs = screen.getByRole('tablist', { name: 'pages.employeeCard.sectionNav' })
    const bar = tabs.closest('.sticky') as HTMLElement

    expect(bar.className).toContain('bg-background')
    expect(bar.className).toContain('bg-dashboard-light')
    expect(bar.className).toContain('[background-attachment:fixed]')
    expect(bar.className).not.toContain('backdrop-blur')
    expect(tabs.className).not.toContain('bg-background')
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

  /*
   * ``secondary`` paints near-black on a dark theme, so the link that could be
   * clicked read as plain text while the disabled one, in muted grey, was the
   * only thing that looked like a button - exactly backwards.
   */
  it('makes the way onward look clickable, not the way that is closed', () => {
    renderAt('/dashboard/team-management/users/7')

    const next = screen.getByRole('link', { name: /pages.employeeCard.nextEmployee/ })
    expect(next.className).toContain('border')
    expect(next.className).not.toContain('bg-secondary-800')
  })

  it('points each control the way it goes', () => {
    renderAt('/dashboard/team-management/users/7')

    const back = screen.getByRole('link', { name: 'pages.employeeCard.backToList' })
    const previous = screen.getByRole('link', { name: /pages.employeeCard.previousEmployee/ })
    const next = screen.getByRole('link', { name: /pages.employeeCard.nextEmployee/ })

    expect(back.querySelector('svg')).not.toBeNull()
    expect(previous.querySelector('svg')).not.toBeNull()
    expect(next.querySelector('svg')).not.toBeNull()
  })

  it('spreads the walk controls across the header rather than bunching them', () => {
    renderAt('/dashboard/team-management/users/7')

    const previous = screen.getByRole('link', { name: 'pages.employeeCard.previousEmployee' })
    expect(previous.parentElement?.className).toContain('justify-between')
  })

  it('leaves the way back over the panel, not among the walk controls', () => {
    renderAt('/dashboard/team-management/users/7')

    const back = screen.getByRole('link', { name: 'pages.employeeCard.backToList' })
    const previous = screen.getByRole('link', { name: /pages.employeeCard.previousEmployee/ })

    expect(back.parentElement).not.toBe(previous.parentElement)
    expect(back.closest('.sticky')).not.toBe(previous.closest('.sticky'))
  })
})

/*
 * The card is a tall, two-column page. A spinner in the middle of an empty
 * one tells the reader nothing about what is coming and then shoves the
 * layout into place when it does - so the wait shows the shape instead.
 */
describe('EmployeeCardPage: while it is still loading', () => {
  beforeEach(() => {
    state.card = null
    state.isLoading = true
    state.isError = false
  })

  it("shows the card's shape rather than a line of text", () => {
    const { container } = renderAt('/dashboard/team-management/users/7')

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(10)
  })

  /*
   * Two dozen empty boxes are worth nothing read aloud. One status message
   * says the same thing in a form somebody can use.
   */
  it('says it is loading once, and hides the boxes from a screen reader', () => {
    const { container } = renderAt('/dashboard/team-management/users/7')

    expect(screen.getByRole('status')).toHaveTextContent('common.loading')
    expect(container.querySelector('[aria-hidden]')).not.toBeNull()
    expect(container.querySelector('[aria-hidden] .animate-pulse')).not.toBeNull()
  })

  it('does not offer controls for a card that is not there yet', () => {
    renderAt('/dashboard/team-management/users/7')

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryAllByRole('button', { name: 'pages.employeeCard.edit' })).toHaveLength(0)
  })

  it('gets out of the way once the card arrives', () => {
    state.card = card()
    state.isLoading = false
    const { container } = renderAt('/dashboard/team-management/users/7')

    expect(container.querySelector('.animate-pulse')).toBeNull()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})

/*
 * A survey carries a score somebody recorded from a form that has long since
 * closed, and its chronology line goes with it. Neither is anywhere else to be
 * recovered from, so the question is asked before the removal, not after.
 */
describe('EmployeeCardPage: removing a survey', () => {
  beforeEach(() => {
    state.card = card({
      surveys: [
        {
          id: 11,
          name: 'Q2 2024 Satisfaction',
          completed_on: '2024-06-15',
          status: 'completed',
          score: 87,
          max_score: 100,
          details_url: null,
        },
      ],
      can_edit: true,
    })
    state.isLoading = false
    state.isError = false
    removeSurvey.mockReset()
  })

  it('asks before removing, naming the one it would remove', async () => {
    renderAt('/dashboard/team-management/users/7')

    await userEvent.click(screen.getByRole('button', { name: /surveys.remove/ }))

    expect(await screen.findByText('pages.employeeCard.surveys.removeTitle')).toBeInTheDocument()
    expect(removeSurvey).not.toHaveBeenCalled()
  })

  it('removes it once the question is answered', async () => {
    renderAt('/dashboard/team-management/users/7')

    await userEvent.click(screen.getByRole('button', { name: /surveys.remove/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(removeSurvey).toHaveBeenCalledWith(11))
  })

  it('leaves it alone when the question is declined', async () => {
    renderAt('/dashboard/team-management/users/7')

    await userEvent.click(screen.getByRole('button', { name: /surveys.remove/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(removeSurvey).not.toHaveBeenCalled()
  })
})
