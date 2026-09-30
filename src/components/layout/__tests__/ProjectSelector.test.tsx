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
 * search type. It also tells the header, once per switch, to drop its own field,
 * results and panel (`switchNonce`, see the DashboardLayout scenes). A click on
 * the current project or a refused switch changes nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { authApi } from '@/features/auth/api/authApi'
import { setAccessToken } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useSearchStore } from '@/stores/searchStore'
import {
  SWITCHER_PROJECTS,
  meIn,
  pickProject,
  renderProjectSelector,
  switchedTo,
} from '@/test/projectSwitch'
import type { User } from '@/types/api'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function userIn(projectId: string) {
  return {
    id: '1',
    projects: SWITCHER_PROJECTS.map((p) => ({
      id: String(p.id),
      name: p.name,
      country: p.country,
      roles: [{ id: String(p.id), name: p.role_name }],
    })),
    active_project_id: projectId,
  } as unknown as User
}

const SEARCH = { searchQuery: '380501234567', searchType: 'name' }

describe('ProjectSelector — the header search stays in the project it was made in', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    useAuthStore.setState({ user: userIn('1') })
    useSearchStore.setState({ ...SEARCH, switchNonce: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setAccessToken(null)
    useAuthStore.setState({ user: null })
    useSearchStore.setState({ searchQuery: '', searchType: 'phone', switchNonce: 0 })
  })

  it('PS-1: a switch to another project clears the search query, keeps its type and stores the new project', async () => {
    const switchProject = vi
      .spyOn(authApi, 'switchProject')
      .mockResolvedValue(switchedTo(3) as never)
    vi.spyOn(authApi, 'me').mockResolvedValue(meIn(3) as never)
    renderProjectSelector()

    pickProject('Project 3')

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(switchProject).toHaveBeenCalledWith(3)
    expect(useAuthStore.getState().user?.active_project_id).toBe('3')
    expect(useSearchStore.getState()).toMatchObject({ searchQuery: '', searchType: 'name' })
  })

  it('PS-2: the switch went through but /me failed — the search is cleared all the same', async () => {
    vi.spyOn(authApi, 'switchProject').mockResolvedValue(switchedTo(3) as never)
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('me failed'))
    renderProjectSelector()

    pickProject('Project 3')

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(useSearchStore.getState()).toMatchObject({ searchQuery: '', searchType: 'name' })
  })

  it('PS-3: a click on the current project asks for nothing and leaves the search alone', async () => {
    const switchProject = vi.spyOn(authApi, 'switchProject')
    renderProjectSelector()

    pickProject('Project 1')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(switchProject).not.toHaveBeenCalled()
    expect(useSearchStore.getState()).toMatchObject({ ...SEARCH, switchNonce: 0 })
    expect(useAuthStore.getState().user?.active_project_id).toBe('1')
  })

  it('PS-4: a refused switch leaves the search and the project as they were', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(authApi, 'switchProject').mockRejectedValue(new Error('refused'))
    const me = vi.spyOn(authApi, 'me')
    renderProjectSelector()

    pickProject('Project 3')

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('refused'))
    expect(me).not.toHaveBeenCalled()
    expect(useSearchStore.getState()).toMatchObject({ ...SEARCH, switchNonce: 0 })
    expect(useAuthStore.getState().user?.active_project_id).toBe('1')
  })

  it('PS-5: a switch tells the header exactly once — switchNonce grows by one — and empties the applied query', async () => {
    vi.spyOn(authApi, 'switchProject').mockResolvedValue(switchedTo(3) as never)
    vi.spyOn(authApi, 'me').mockResolvedValue(meIn(3) as never)
    renderProjectSelector()

    pickProject('Project 3')

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(useSearchStore.getState()).toMatchObject({ searchQuery: '', switchNonce: 1 })
  })
})
