/**
 * Routes of the «Планування» section (planner stories 1.9–1.10), mounted under
 * `/dashboard` by `src/routes/index.tsx`. Kept in their own module so the
 * section tests exercise the real route table rather than a copy of it.
 *
 * `planner.access` opens the route; the section itself shows only when the
 * planner's `GET /meta` says `available: true` — otherwise PlannerLayout renders
 * «Планер тимчасово недоступний. Решта CRM працює» and the rest of the CRM works.
 */
import { lazy, Suspense, type ReactElement } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { PermissionRoute } from './PermissionRoute'
import { PERMISSIONS } from '@/constants/permissions'
import { AppLoadingFallback } from '@/components/ui/AppLoadingFallback'
// The «no access» text is rendered by PermissionRoute BEFORE the section chunk
// loads — imported directly, not through the `@/pages/Planner` barrel.
import { PlannerGateMessage } from '@/pages/Planner/components/PlannerGateMessage'

const PlannerLayout = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerLayout }))
)
const PlannerMyTasksPage = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerMyTasksPage }))
)
const PlannerBoardPage = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerBoardPage }))
)
const PlannerCalendarPage = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerCalendarPage }))
)
const PlannerTaskLinkRedirect = lazy(() =>
  import('@/pages/Planner').then((m) => ({ default: m.PlannerTaskLinkRedirect }))
)

const withSuspense = (element: ReactElement) => (
  <Suspense fallback={<AppLoadingFallback />}>{element}</Suspense>
)

export const plannerRoute: RouteObject = {
  path: 'planning',
  element: (
    <PermissionRoute
      requiredPermission={PERMISSIONS.PLANNER.ACCESS}
      fallback={<PlannerGateMessage kind="no-access" />}
    >
      {withSuspense(<PlannerLayout />)}
    </PermissionRoute>
  ),
  children: [
    { index: true, element: <Navigate to="/dashboard/planning/tasks" replace /> },
    { path: 'tasks', element: withSuspense(<PlannerMyTasksPage />) },
    { path: 'tasks/boards/:code', element: withSuspense(<PlannerBoardPage />) },
    { path: 'calendar', element: withSuspense(<PlannerCalendarPage />) },
    // Permanent link `planning/t/<KEY>` (AD-35): the task panel over «Мої задачі».
    { path: 't/:key', element: withSuspense(<PlannerTaskLinkRedirect />) },
  ],
}
