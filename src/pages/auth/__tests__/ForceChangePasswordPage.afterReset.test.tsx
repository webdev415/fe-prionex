/**
 * The first sign-in after an admin password reset, end to end through the real
 * auth store, login hook, route guards and change-password page. Only the
 * network is replaced.
 *
 * The backend ends the session as part of the password change, so the logout
 * that follows is answered 401. That rejection used to escape the store's
 * logout: the page skipped its own redirect to /login, ProtectedRoute bounced
 * there instead and recorded /change-password as where the user came from,
 * and the next sign-in sent the user straight back to the form -- with
 * must_change_password already false.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const server = vi.hoisted(() => ({ mustChange: true, logoutStatus: 401 }))

vi.mock('@/features/auth/api/authApi', () => {
  const user = () => ({
    id: 7,
    username: 'reset.user',
    email: 'reset.user@example.com',
    first_name: 'Reset',
    last_name: 'User',
    status: 'active',
    must_change_password: server.mustChange,
    projects: [],
    permissions: [],
  })
  const api = {
    login: vi.fn(async () => ({ data: { token: 'h.eyJzdWIiOiI3In0.s', user: user() } })),
    me: vi.fn(async () => ({ data: user() })),
    myProjects: vi.fn(async () => ({ data: { projects: [] } })),
    validate: vi.fn(async () => ({ data: { valid: true } })),
    changePassword: vi.fn(async () => {
      server.mustChange = false
      return { data: {} }
    }),
    logout: vi.fn(async () => {
      if (server.logoutStatus === 401) {
        throw Object.assign(new Error('Request failed with status code 401'), {
          response: { status: 401, data: {} },
        })
      }
      return { data: {} }
    }),
  }
  return { authApi: api, default: api }
})
// Side effects of a profile load that the jsdom setup cannot run.
vi.mock('@/lib/i18n', async (orig) => ({
  ...(await orig<object>()),
  applyPersistedLanguageFromServer: vi.fn(),
}))
vi.mock('@/stores/themeStore', async (orig) => ({
  ...(await orig<object>()),
  applyPersistedThemeFromServer: vi.fn(),
}))
vi.mock('@/features/auth/hooks/useStoredTabs', () => ({
  useStoredTabs: () => ({ data: undefined, isLoading: false }),
  useConsumeSnapshot: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}))

import { GuestRoute } from '@/routes/GuestRoute'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import ForceChangePasswordPage from '@/pages/auth/ForceChangePasswordPage'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { setAccessToken } from '@/lib/api'

function SignIn() {
  const { login } = useAuth()
  return (
    <button onClick={() => void login({ username: 'reset.user', password: 'x' })}>SIGN IN</button>
  )
}

function renderApp(startAt: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/login',
        element: (
          <GuestRoute>
            <SignIn />
          </GuestRoute>
        ),
      },
      {
        path: '/change-password',
        element: (
          <ProtectedRoute>
            <ForceChangePasswordPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute>
            <div>DASHBOARD</div>
          </ProtectedRoute>
        ),
      },
    ],
    { initialEntries: [startAt] }
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)))

async function signIn() {
  await act(async () => {
    fireEvent.click(screen.getByText('SIGN IN'))
  })
  await settle()
}

async function setOwnPassword() {
  const [password, confirm] = document.querySelectorAll('input[type="password"]')
  fireEvent.change(password, { target: { value: 'NewPassw0rd!' } })
  fireEvent.change(confirm, { target: { value: 'NewPassw0rd!' } })
  await act(async () => {
    fireEvent.submit(password.closest('form')!)
  })
  await settle()
}

beforeEach(() => {
  server.mustChange = true
  server.logoutStatus = 401
  setAccessToken(null)
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasCheckedAuth: false,
  })
})

describe('first sign-in after an admin password reset', () => {
  it('lands on the Dashboard after the user signs in with the password they set', async () => {
    const router = renderApp('/login')

    await signIn()
    expect(router.state.location.pathname).toBe('/change-password')

    await setOwnPassword()
    expect(router.state.location.pathname).toBe('/login')
    // The bounce through ProtectedRoute is what used to carry this.
    expect(router.state.location.state).toBeNull()

    await signIn()
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
  })

  it('still lands on the Dashboard when the logout call succeeds', async () => {
    server.logoutStatus = 200
    const router = renderApp('/login')

    await signIn()
    await setOwnPassword()
    await signIn()

    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('still sends a user who must change the password to the form', async () => {
    const router = renderApp('/login')

    await signIn()

    expect(router.state.location.pathname).toBe('/change-password')
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(2)
  })

  it('moves a user with nothing to change off the form, as after a refresh', async () => {
    server.mustChange = false
    setAccessToken('h.eyJzdWIiOiI3In0.s')
    const router = renderApp('/change-password')

    await settle()

    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('never returns to /change-password from a recorded bounce', async () => {
    server.mustChange = false
    const router = createMemoryRouter(
      [
        {
          path: '/login',
          element: (
            <GuestRoute>
              <SignIn />
            </GuestRoute>
          ),
        },
        { path: '/change-password', element: <div>FORM</div> },
        { path: '/dashboard', element: <div>DASHBOARD</div> },
      ],
      {
        initialEntries: [{ pathname: '/login', state: { from: { pathname: '/change-password' } } }],
      }
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    await signIn()

    expect(router.state.location.pathname).toBe('/dashboard')
  })
})
