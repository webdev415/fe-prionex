/**
 * ProjectSelector — a project switch leaves the header search behind
 * (story 17-56b, AC-1; DEV acceptance of 17-56, finding F-1).
 *
 * The switcher lives on the profile page only, so the clients page is not
 * mounted while the project changes and its own "live switch" guard never
 * runs. The header search sits in a global store: left there, it went into the
 * next project's first clients request and was saved into that project's
 * filter set. The switcher clears the query itself once the switch went
 * through — on both branches, with or without the fresh /me — and keeps the
 * search type. A click on the current project or a refused switch changes
 * nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/features/auth/api/authApi'
import { setAccessToken } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useSearchStore } from '@/stores/searchStore'
import type { User } from '@/types/api'
import { ProjectSelector } from '../ProjectSelector'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const PROJECTS = [
  { id: 1, name: 'Project 1', country: 'UA', role_name: 'Admin' },
  { id: 3, name: 'Project 3', country: 'CA', role_name: 'Admin' },
]

function userIn(projectId: string) {
  return {
    id: '1',
    projects: PROJECTS.map((p) => ({
      id: String(p.id),
      name: p.name,
      country: p.country,
      roles: [{ id: String(p.id), name: p.role_name }],
    })),
    active_project_id: projectId,
  } as unknown as User
}

/** GET /api/v1/users/me after the switch, as the backend answers it. */
function meIn(projectId: number) {
  const active = PROJECTS.find((p) => p.id === projectId)
  return { data: { id: 1, username: 'operator', projects: PROJECTS, active_project: active } }
}

function switchedTo(projectId: number) {
  const active = PROJECTS.find((p) => p.id === projectId)
  return {
    data: { access_token: `token-${projectId}`, active_project: { project_name: active?.name } },
  }
}

function renderSelector() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProjectSelector />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/** Open the menu the way a mouse does and click a project in it. */
function pickProject(name: string) {
  const trigger = screen.getByRole('button')
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  const item = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes(name))
  if (!item) throw new Error(`no menu item ${name}`)
  fireEvent.click(item)
}

const SEARCH = { searchQuery: '380501234567', searchType: 'name' }

describe('ProjectSelector — the header search stays in the project it was made in', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    useAuthStore.setState({ user: userIn('1') })
    useSearchStore.setState(SEARCH)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setAccessToken(null)
    useAuthStore.setState({ user: null })
    useSearchStore.setState({ searchQuery: '', searchType: 'phone' })
  })

  it('PS-1: a switch to another project clears the search query, keeps its type and stores the new project', async () => {
    const switchProject = vi
      .spyOn(authApi, 'switchProject')
      .mockResolvedValue(switchedTo(3) as never)
    vi.spyOn(authApi, 'me').mockResolvedValue(meIn(3) as never)
    renderSelector()

    pickProject('Project 3')

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(switchProject).toHaveBeenCalledWith(3)
    expect(useAuthStore.getState().user?.active_project_id).toBe('3')
    expect(useSearchStore.getState()).toMatchObject({ searchQuery: '', searchType: 'name' })
  })

  it('PS-2: the switch went through but /me failed — the search is cleared all the same', async () => {
    vi.spyOn(authApi, 'switchProject').mockResolvedValue(switchedTo(3) as never)
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('me failed'))
    renderSelector()

    pickProject('Project 3')

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(useSearchStore.getState()).toMatchObject({ searchQuery: '', searchType: 'name' })
  })

  it('PS-3: a click on the current project asks for nothing and leaves the search alone', async () => {
    const switchProject = vi.spyOn(authApi, 'switchProject')
    renderSelector()

    pickProject('Project 1')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(switchProject).not.toHaveBeenCalled()
    expect(useSearchStore.getState()).toMatchObject(SEARCH)
    expect(useAuthStore.getState().user?.active_project_id).toBe('1')
  })

  it('PS-4: a refused switch leaves the search and the project as they were', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(authApi, 'switchProject').mockRejectedValue(new Error('refused'))
    const me = vi.spyOn(authApi, 'me')
    renderSelector()

    pickProject('Project 3')

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('refused'))
    expect(me).not.toHaveBeenCalled()
    expect(useSearchStore.getState()).toMatchObject(SEARCH)
    expect(useAuthStore.getState().user?.active_project_id).toBe('1')
  })
})
