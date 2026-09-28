/**
 * «Планування» section of the CRM (planner story 1.9) on the real route table
 * (`src/routes/plannerRoutes.tsx`): permission gate, `GET /meta` gate, tabs,
 * second-level switcher, prep banner, calendar placeholder, permanent link.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'

const auth = vi.hoisted(() => ({ permissions: ['planner.access'] as string[] }))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  const { plannerUseTranslation } = await import('./plannerUkI18n')
  return { ...actual, useTranslation: plannerUseTranslation }
})
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: { id: '7', permissions: auth.permissions } }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const api = vi.hoisted(() => ({
  getMeta: vi.fn(),
  listBoards: vi.fn(),
  listMyTasks: vi.fn(),
  resolveTask: vi.fn(),
  getBoard: vi.fn(),
  listBoardTasks: vi.fn(),
}))
vi.mock('@/api/planner/plannerApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/planner/plannerApi')>()
  return { ...actual, ...api }
})

import { plannerRoute } from '@/routes/plannerRoutes'
import { makeBoard, makeCard, makeMeta, makeTask } from './plannerFixtures'

// The section is lazy-loaded. On a loaded CI runner the first render spent more
// than the 5 s query timeout on transforming the chunk and the test saw only the
// loading fallback. The chunk is imported once here, so every test renders the
// page itself.
beforeAll(async () => {
  await import('@/pages/Planner')
}, 120_000)

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(
    [{ path: '/dashboard', element: <Outlet />, children: [plannerRoute] }],
    { initialEntries: [path] }
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

describe('Планування — раздел CRM (1.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.permissions = ['planner.access']
    api.getMeta.mockResolvedValue(makeMeta())
    api.listBoards.mockResolvedValue({
      items: [
        {
          id: 'b1',
          code: 'SKL',
          name: 'Склад',
          kind: 'team',
          version: 1,
          role: 'board_member',
          allowed_actions: ['create_task'],
        },
      ],
    })
    api.listMyTasks.mockResolvedValue({ items: [makeCard()], has_more: false })
    // The status chip loads its board up front (1.10, bot round 2).
    api.getBoard.mockResolvedValue(makeBoard())
  })

  it('без planner.access прямой адрес показывает «Немає доступу…», а планер не спрашивают', async () => {
    auth.permissions = ['view_clients']
    renderAt('/dashboard/planning/tasks')
    expect(
      await screen.findByText(
        'Немає доступу до Планера. Зверніться до керівника або адміністратора CRM'
      )
    ).toBeInTheDocument()
    expect(api.getMeta).not.toHaveBeenCalled()
  })

  it('available: false — «Планер тимчасово недоступний. Решта CRM працює»', async () => {
    api.getMeta.mockResolvedValue(makeMeta({ available: false, mode: 'off' }))
    renderAt('/dashboard/planning/tasks')
    expect(
      await screen.findByText('Планер тимчасово недоступний. Решта CRM працює')
    ).toBeInTheDocument()
    expect(api.listMyTasks).not.toHaveBeenCalled()
  })

  it('отказ /meta (стенд без планера, 404) читается как «недоступний», а не как раздел', async () => {
    api.getMeta.mockRejectedValue(Object.assign(new Error('404'), { isAxiosError: true }))
    renderAt('/dashboard/planning/tasks')
    expect(
      await screen.findByText('Планер тимчасово недоступний. Решта CRM працює')
    ).toBeInTheDocument()
  })

  it('вход ведёт на «Мої задачі»: вкладки только «Задачі» и «Календар», второй уровень «Мої задачі · Дошка ▾»', async () => {
    const router = renderAt('/dashboard/planning')
    expect(await screen.findByText('Поставлені мені')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard/planning/tasks')

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Задачі', 'Календар'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')

    const nav = screen.getByRole('navigation', { name: 'Перегляд задач' })
    expect(within(nav).getByRole('link', { name: 'Мої задачі' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(nav).getByRole('button', { name: /Дошка/ })).toBeInTheDocument()

    expect(await screen.findByText('Перевірити залишки')).toBeInTheDocument()
    expect(screen.queryByText(/Режим підготовки/)).not.toBeInTheDocument()
  })

  it('«Дошка ▾» перечисляет доски участника и открывает выбранную', async () => {
    api.getBoard.mockReturnValue(new Promise(() => {}))
    api.listBoardTasks.mockReturnValue(new Promise(() => {}))
    const router = renderAt('/dashboard/planning/tasks')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Дошка/ }))
    await user.click(await screen.findByRole('menuitem', { name: /Склад/ }))
    expect(router.state.location.pathname).toBe('/dashboard/planning/tasks/boards/SKL')
  })

  it('положение prep — баннер подготовки у тех, кому раздел доступен', async () => {
    api.getMeta.mockResolvedValue(makeMeta({ mode: 'prep' }))
    renderAt('/dashboard/planning/tasks')
    expect(
      await screen.findByText(
        'Режим підготовки: розділ бачать лише адміністратор Планера, керівники відділів і відповідальні за запуск'
      )
    ).toBeInTheDocument()
  })

  it('«Календар» до историй 5.13–5.14 — пустое состояние', async () => {
    renderAt('/dashboard/planning/calendar')
    expect(await screen.findByText("Календар з'явиться найближчим часом")).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Календар' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('navigation', { name: 'Перегляд задач' })).not.toBeInTheDocument()
  })

  it('постоянная ссылка planning/t/SKL-2 открывает панель задачи поверх «Мої задачі»', async () => {
    api.resolveTask.mockResolvedValue(makeTask())
    const router = renderAt('/dashboard/planning/t/SKL-2')
    expect(await screen.findByRole('complementary', { name: 'Задача SKL-2' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard/planning/tasks')
    expect(router.state.location.search).toBe('?task=SKL-2')
    expect(api.resolveTask).toHaveBeenCalledWith('SKL-2')
  })
})
