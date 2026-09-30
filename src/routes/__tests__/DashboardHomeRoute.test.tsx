/**
 * The home choice at /dashboard (story 17-56, Р-9/Р-10).
 *
 * The index page needs `view_clients`. Credit roles hold only `credit.*`, yet
 * sign-in, "view as" and every unknown address land on /dashboard — so they
 * met a 403 page. With the right to read credit applications they are sent to
 * the applications list instead, replacing the history entry so "Back" does
 * not bounce into the redirect again. Everyone else keeps the old behaviour.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { PermissionRoute } from '../PermissionRoute'
import { DashboardHomeRoute } from '../DashboardHomeRoute'

const FORBIDDEN = 'pages.forbidden.title'
const CREDIT_ROLE = ['credit.applications.read', 'credit.loans.read', 'credit.documents.read']

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <p data-testid="path">{location.pathname}</p>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  )
}

function renderHome(entries: string[] = ['/dashboard']) {
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/before" element={<p>Before</p>} />
        <Route path="/dashboard">
          <Route
            index
            element={
              <DashboardHomeRoute>
                <p>Clients</p>
              </DashboardHomeRoute>
            }
          />
          <Route
            path="credit/applications"
            element={
              <PermissionRoute
                requiredPermissions={[
                  PERMISSIONS.CREDIT.APPLICATIONS_VIEW,
                  PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
                ]}
                mode="any"
              >
                <p>Credit applications</p>
              </PermissionRoute>
            }
          />
        </Route>
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  )
}

function signInWith(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: '1',
      projects: [{ id: '1', name: 'Project', country: 'UA', roles: [] }],
      active_project_id: '1',
      permissions,
    } as unknown as User,
  })
}

describe('DashboardHomeRoute', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('H-1: shows the clients list to a role with view_clients, even with credit rights', () => {
    signInWith(['view_clients', 'credit.applications.read'])
    renderHome()

    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/dashboard$/)
    expect(screen.queryByText('Credit applications')).not.toBeInTheDocument()
  })

  it('H-2: sends a credit role to the credit applications list instead of a 403', () => {
    signInWith(CREDIT_ROLE)
    renderHome()

    expect(screen.getByText('Credit applications')).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/dashboard/credit/applications')
    expect(screen.queryByText(FORBIDDEN)).not.toBeInTheDocument()
    expect(screen.queryByText('Clients')).not.toBeInTheDocument()
  })

  it('H-3: keeps the 403 page for a role with neither right', () => {
    signInWith(['view_tasks'])
    renderHome()

    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/dashboard$/)
  })

  it('H-4: keeps the 403 page for a role that reads only loans', () => {
    signInWith(['credit.loans.read'])
    renderHome()

    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/dashboard$/)
    expect(screen.queryByText('Credit applications')).not.toBeInTheDocument()
  })

  it('H-5: "Back" after the redirect returns to the page before /dashboard', async () => {
    signInWith(CREDIT_ROLE)
    renderHome(['/before', '/dashboard'])
    expect(screen.getByTestId('path')).toHaveTextContent('/dashboard/credit/applications')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByText('Before')).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/before$/)
  })

  it('H-7: keeps the 403 page for a system administrator without view_clients', () => {
    signInWith([PERMISSIONS.SYSTEM.MANAGE_SETTINGS])
    renderHome()

    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/dashboard$/)
    expect(screen.queryByText('Credit applications')).not.toBeInTheDocument()
  })
})

const ROUTES_SOURCE = Object.values(
  import.meta.glob('../index.tsx', { query: '?raw', import: 'default', eager: true })
)[0] as string

// A right commented out while debugging is the likeliest way to drop it
// silently — the same cut as creditRoutesPermissionAlternative.test.ts.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('the /dashboard index in the route table', () => {
  it('H-6: wraps the clients page in the home choice, and the target lets the same right in', () => {
    expect(ROUTES_SOURCE).toMatch(
      /index: true,\s*element: <DashboardHomeRoute>\{withSuspense\(<ClientManagementPage \/>\)\}<\/DashboardHomeRoute>/
    )

    const code = stripComments(ROUTES_SOURCE)
    const start = code.indexOf("path: 'credit/applications',")
    expect(start).toBeGreaterThan(-1)
    const end = code.indexOf('path:', start + 'path:'.length)
    expect(code.slice(start, end)).toContain('PERMISSIONS.CREDIT.APPLICATIONS_VIEW')
  })
})
