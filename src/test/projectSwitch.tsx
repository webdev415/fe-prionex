/**
 * The project switcher as an operator uses it (story 17-56b): the real
 * ProjectSelector on its own, its menu opened the way a mouse does, a project
 * clicked; the answers of the switch and of the fresh /me as the backend gives
 * them. Shared by the switcher's own scenes and by the clients page scenes that
 * switch on the profile page.
 *
 * ⚠️ NOT named `*.test.tsx` on purpose: `vitest.config.ts` collects every file
 * under `src` whose name ends in `.test.*`, and a helper picked up as a suite
 * fails the run with "no test suite found".
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ProjectSelector } from '@/components/layout/ProjectSelector'

export const SWITCHER_PROJECTS = [
  { id: 1, name: 'Project 1', country: 'UA', role_name: 'Admin' },
  { id: 3, name: 'Project 3', country: 'CA', role_name: 'Admin' },
]

function projectNamed(projectId: number) {
  return SWITCHER_PROJECTS.find((p) => p.id === projectId)
}

/** POST /api/v1/auth/switch-project, as the backend answers it. */
export function switchedTo(projectId: number) {
  return {
    data: {
      access_token: `token-${projectId}`,
      active_project: { project_name: projectNamed(projectId)?.name },
    },
  }
}

/** GET /api/v1/users/me after the switch, as the backend answers it. */
export function meIn(projectId: number) {
  return {
    data: {
      id: 1,
      username: 'operator',
      projects: SWITCHER_PROJECTS,
      active_project: projectNamed(projectId),
    },
  }
}

export function renderProjectSelector() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProjectSelector />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/** Open the switcher's menu the way a mouse does and click a project in it. */
export function pickProject(name: string) {
  const trigger = screen.getByRole('button')
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  const item = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes(name))
  if (!item) throw new Error(`no menu item ${name}`)
  fireEvent.click(item)
}
