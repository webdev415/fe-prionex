/**
 * The UBKI integration page guard (story 17-56, Р-4).
 *
 * UBKI is Ukrainian-only, so the page opens only when the active project is
 * Ukrainian by its raw country code. The shared country guard folds a Canadian
 * project into 'UA' and would let the page open by a direct address.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { UbkiProjectRoute } from '../UbkiProjectRoute'

const UBKI_PATH = '/dashboard/system-settings/integrations/ubki'

function renderRoute() {
  render(
    <MemoryRouter initialEntries={[UBKI_PATH]}>
      <Routes>
        <Route
          path={UBKI_PATH}
          element={
            <UbkiProjectRoute>
              <p>UBKI integration</p>
            </UbkiProjectRoute>
          }
        />
        <Route path="/dashboard" element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>
  )
}

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

function renderRouteAfterAnotherPage() {
  render(
    <MemoryRouter initialEntries={['/before', UBKI_PATH]} initialIndex={1}>
      <Routes>
        <Route path="/before" element={<p>Before</p>} />
        <Route
          path={UBKI_PATH}
          element={
            <UbkiProjectRoute>
              <p>UBKI integration</p>
            </UbkiProjectRoute>
          }
        />
        <Route path="/dashboard" element={<p>Dashboard</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  )
}

function setProjectCountry(country: string | undefined) {
  useAuthStore.setState({
    user: {
      id: '1',
      projects: [{ id: '2', name: 'Project', country, roles: [] }],
      active_project_id: '2',
    } as unknown as User,
  })
}

describe('UbkiProjectRoute', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('U-1: opens the page in a Ukrainian project', () => {
    setProjectCountry('UA')
    renderRoute()
    expect(screen.getByText('UBKI integration')).toBeInTheDocument()
  })

  it('U-2: sends a Canadian project back to the dashboard', () => {
    setProjectCountry('CA')
    renderRoute()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('UBKI integration')).not.toBeInTheDocument()
  })

  it('U-3: opens the page in a project without a country code', () => {
    setProjectCountry(undefined)
    renderRoute()
    expect(screen.getByText('UBKI integration')).toBeInTheDocument()
  })

  it('U-5: "Back" after the redirect returns to the page before the UBKI address', async () => {
    setProjectCountry('CA')
    renderRouteAfterAnotherPage()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/dashboard$/)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByText('Before')).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/before$/)
  })
})

const ROUTES_SOURCE = Object.values(
  import.meta.glob('../index.tsx', { query: '?raw', import: 'default', eager: true })
)[0] as string

describe('the UBKI integration route', () => {
  it('U-4: is guarded by UbkiProjectRoute, not by the folded country guard', () => {
    expect(ROUTES_SOURCE).toMatch(
      /<UbkiProjectRoute>\s*\{withSuspense\(<UbkiIntegrationPage \/>\)\}/
    )
    expect(ROUTES_SOURCE).not.toMatch(
      /<UkrainianProjectRoute>\s*\{withSuspense\(<UbkiIntegrationPage/
    )
  })
})
