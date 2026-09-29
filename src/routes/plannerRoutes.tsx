/**
 * Routes of the «Планування» section (planner stories 1.9–1.10), mounted under
 * `/dashboard` by `src/routes/index.tsx`. Kept in their own module so the
 * section tests exercise the real route table rather than a copy of it.
 *
 * `planner.access` opens the route; the section itself shows only when the
 * planner's `GET /meta` says `available: true` — otherwise PlannerLayout renders
 * «Планер тимчасово недоступний. Решта CRM працює» and the rest of the CRM works.
 *
 * While the section's chunk loads, each route shows the shape of what is coming
 * (planner story 5.1, AC4; EXPERIENCE «Скелетон»): the section header for the
 * layout, skeleton rows or columns for a screen — never the app's full-screen
 * spinner (`AppLoadingFallback`, `min-h-dvh`).
 *
 * All screens live in ONE chunk (the `@/pages/Planner` barrel), so it is the
 * layout's boundary that shows while it loads; by the time a screen renders,
 * the chunk is there and its lazy resolves at once. The screens keep their own
 * boundaries anyway, each in the shape of its screen: without them a screen
 * that suspends would climb to the layout's boundary and swap the whole
 * section — header, tabs, banners — for the loading line (5.1, bot round 1).
 */
import { lazy, Suspense, type ReactElement } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { PermissionRoute } from './PermissionRoute'
import { PERMISSIONS } from '@/constants/permissions'
// The «no access» text is rendered by PermissionRoute BEFORE the section chunk
// loads, and the skeletons stand in for it while it loads — imported directly,
// not through the `@/pages/Planner` barrel.
import { PlannerGateMessage } from '@/pages/Planner/components/PlannerGateMessage'
import {
  BoardSkeleton,
  CalendarSkeleton,
  TaskListSkeleton,
} from '@/pages/Planner/components/PlannerStates'

const PlannerLayout = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerLayout }))
)
const PlannerMyTasksPage = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerMyTasksPage }))
)
const PlannerBoardPage = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerBoardPage }))
)
const PlannerBoardSettingsPage = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerBoardSettingsPage }))
)
const PlannerCalendarPage = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerCalendarPage }))
)
const PlannerTaskLinkRedirect = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerTaskLinkRedirect }))
)

const withSuspense = (element: ReactElement, fallback: ReactElement = <TaskListSkeleton />) => (
  <Suspense fallback={fallback}>{element}</Suspense>
)

export const plannerRoute: RouteObject = {
  path: 'planning',
  element: (
    <PermissionRoute
      requiredPermission={PERMISSIONS.PLANNER.ACCESS}
      fallback={<PlannerGateMessage kind="no-access" />}
    >
      {withSuspense(<PlannerLayout />, <PlannerGateMessage kind="loading" />)}
    </PermissionRoute>
  ),
  children: [
    { index: true, element: <Navigate to="/dashboard/planning/tasks" replace /> },
    { path: 'tasks', element: withSuspense(<PlannerMyTasksPage />) },
    { path: 'tasks/boards/:code', element: withSuspense(<PlannerBoardPage />, <BoardSkeleton />) },
    // `⚙` of the board header (5.3); the settings editor itself is story 5.10.
    {
      path: 'tasks/boards/:code/settings/*',
      element: withSuspense(<PlannerBoardSettingsPage />, <CalendarSkeleton />),
    },
    { path: 'calendar', element: withSuspense(<PlannerCalendarPage />, <CalendarSkeleton />) },
    // Permanent link `planning/t/<KEY>` (AD-35): the task panel over «Мої задачі».
    { path: 't/:key', element: withSuspense(<PlannerTaskLinkRedirect />) },
  ],
}
