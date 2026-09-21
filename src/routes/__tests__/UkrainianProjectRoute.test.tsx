import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { UkrainianProjectRoute } from '../UkrainianProjectRoute'

function renderRoute() {
  render(
    <MemoryRouter initialEntries={['/dashboard/ai-assistant']}>
      <Routes>
        <Route
          path="/dashboard/ai-assistant"
          element={
            <UkrainianProjectRoute>
              <p>Assistant</p>
            </UkrainianProjectRoute>
          }
        />
        <Route path="/dashboard" element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function setProjectCountry(country: string) {
  useAuthStore.setState({
    user: {
      id: '1',
      projects: [{ id: '2', name: 'Project', country, roles: [] }],
      active_project_id: '2',
    } as unknown as User,
  })
}

describe('UkrainianProjectRoute', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('opens the page in a Ukrainian project', () => {
    setProjectCountry('UA')
    renderRoute()
    expect(screen.getByText('Assistant')).toBeInTheDocument()
  })

  it('sends a Spanish project back to the dashboard', () => {
    setProjectCountry('ES')
    renderRoute()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument()
  })
})

const ROUTES_SOURCE = Object.values(
  import.meta.glob('../index.tsx', { query: '?raw', import: 'default', eager: true })
)[0] as string

describe('the routes that only Ukrainian projects may open', () => {
  it.each(['AiAssistantPage', 'UbkiIntegrationPage'])('guards %s', (page) => {
    const wrapped = new RegExp(`<UkrainianProjectRoute>\\s*\\{withSuspense\\(<${page} />\\)\\}`)
    expect(ROUTES_SOURCE).toMatch(wrapped)
  })
})
