/**
 * While the section's chunk loads, the route shows the section's own loading
 * shape, never the app's full-screen spinner (planner story 5.1, AC4;
 * EXPERIENCE «Скелетон: спиннер на весь экран запрещён»).
 *
 * The chunk is held back on purpose: `@/pages/Planner` resolves only when the
 * test releases it, so the Suspense fallback is what the screen shows first.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  const { plannerUseTranslation } = await import('./plannerUkI18n')
  return { ...actual, useTranslation: plannerUseTranslation }
})
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: { id: '7', permissions: ['planner.access'] } }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const chunk = vi.hoisted(() => {
  let release: () => void = () => {}
  const ready = new Promise<void>((resolve) => (release = resolve))
  return { ready, release: () => release() }
})
vi.mock('@/pages/Planner', async (importOriginal) => {
  await chunk.ready
  return importOriginal()
})

const api = vi.hoisted(() => ({
  getMeta: vi.fn(),
  listBoards: vi.fn(),
  listMyTasks: vi.fn(),
  getBoard: vi.fn(),
}))
vi.mock('@/api/planner/plannerApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/planner/plannerApi')>()
  return { ...actual, ...api }
})

import type { ReactElement } from 'react'
import { plannerRoute } from '@/routes/plannerRoutes'
import plannerRoutesSource from '@/routes/plannerRoutes.tsx?raw'
import {
  BoardSkeleton,
  CalendarSkeleton,
  TaskListSkeleton,
} from '@/pages/Planner/components/PlannerStates'
import { makeBoard, makeCard, makeMeta } from './plannerFixtures'

describe('загрузка раздела «Планування» — без спиннера на весь экран (5.1 AC4)', () => {
  it('пока грузится чанк — шапка-скелетон раздела, потом сам раздел', async () => {
    api.getMeta.mockResolvedValue(makeMeta())
    api.listBoards.mockResolvedValue({ items: [] })
    api.listMyTasks.mockResolvedValue({ items: [makeCard()], has_more: false })
    api.getBoard.mockResolvedValue(makeBoard())
    const router = createMemoryRouter(
      [{ path: '/dashboard', element: <Outlet />, children: [plannerRoute] }],
      { initialEntries: ['/dashboard/planning/tasks'] }
    )
    const { container } = render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    const loading = await screen.findByText('Завантаження Планера…')
    expect(loading.closest('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('.animate-spin')).toBeNull()
    expect(container.querySelector('.min-h-dvh')).toBeNull()

    chunk.release()
    expect(await screen.findByText('Перевірити залишки', {}, { timeout: 30_000 })).toBeVisible()
    expect(screen.queryByText('Завантаження Планера…')).toBeNull()
  }, 60_000)

  // Review bot round 1: every screen waits in its own shape — the calendar
  // (an empty-state box until 5.13) is not a list.
  it.each([
    ['tasks', TaskListSkeleton],
    ['tasks/boards/:code', BoardSkeleton],
    ['calendar', CalendarSkeleton],
  ] as const)('экран %s ждёт в своей форме', (path, skeleton) => {
    const route = plannerRoute.children?.find((child) => child.path === path)
    const boundary = route?.element as ReactElement<{ fallback: ReactElement }> | undefined
    expect(boundary?.props.fallback.type).toBe(skeleton)
  })

  it('ни один маршрут раздела не берёт полноэкранный AppLoadingFallback', () => {
    expect(plannerRoutesSource).not.toMatch(/AppLoadingFallback\s*\/>/)
    expect(plannerRoutesSource).not.toMatch(/import\s*{[^}]*AppLoadingFallback/)
  })
})
