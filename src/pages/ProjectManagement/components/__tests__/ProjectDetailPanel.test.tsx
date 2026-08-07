import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ApiProjectDetail } from '@/features/projects/types'
import { ProjectDetailPanel } from '../ProjectDetailPanel'

vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  }
})

const project: ApiProjectDetail = {
  id: 1,
  name: 'Project Alpha',
  code: 'ALPHA',
  description: 'A project',
  status: 'active',
  is_active: true,
  client_company: 'Acme',
  contract_number: 'C-1',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  total_clients: 10,
  total_debt_amount: '1000.00',
  user_count: 5,
  role_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  created_by: { id: 1, username: 'admin' },
  statistics: { user_count: 5, active_user_count: 4, role_count: 3, custom_role_count: 1 },
  roles: [],
  default_roles: [],
  assigned_users_count: 5,
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <ProjectDetailPanel project={project} hasProjects onEdit={vi.fn()} />
    </MemoryRouter>
  )
}

describe('ProjectDetailPanel actions', () => {
  it('renders the Edit action', () => {
    renderPanel()
    expect(screen.getByText('pages.projects.detailPanel.edit')).toBeInTheDocument()
  })

  it('does not render a Delete action', () => {
    renderPanel()
    expect(screen.queryByText('pages.projects.detailPanel.delete')).not.toBeInTheDocument()
  })
})
