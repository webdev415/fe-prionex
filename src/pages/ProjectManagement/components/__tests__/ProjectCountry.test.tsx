import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ApiProjectDetail } from '@/features/projects/types'
import { CreateProjectModal } from '../CreateProjectModal'
import { EditProjectModal } from '../EditProjectModal'

const createProject = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const updateProject = vi.hoisted(() => vi.fn().mockResolvedValue({}))

vi.mock('@/features/projects/hooks/useProjectMutations', () => ({
  useCreateProject: () => ({ mutateAsync: createProject, isPending: false, isError: false }),
  useUpdateProject: () => ({ mutateAsync: updateProject, isPending: false, isError: false }),
}))

const project = {
  id: 7,
  name: 'Cartera Madrid',
  code: 'MAD',
  status: 'active',
  is_active: true,
  currency: 'EUR',
  country: 'UA',
  total_clients: 0,
  total_debt_amount: '0',
  created_at: '2026-09-18T10:00:00Z',
  updated_at: '2026-09-18T10:00:00Z',
} as unknown as ApiProjectDetail

function spain() {
  return screen.getByRole('radio', { name: 'pages.projects.modals.country.ES' })
}

describe('project country', () => {
  beforeEach(() => {
    createProject.mockClear()
    updateProject.mockClear()
  })

  it('creates projects in Ukraine by default', async () => {
    render(<CreateProjectModal open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('pages.projects.modals.create.projectName'), {
      target: { value: 'Cartera Kyiv' },
    })
    fireEvent.change(screen.getByLabelText('pages.projects.modals.create.projectCode'), {
      target: { value: 'KYIV' },
    })
    fireEvent.submit(document.getElementById('create-project-form') as HTMLFormElement)

    await waitFor(() => expect(createProject).toHaveBeenCalled())
    expect(createProject.mock.calls[0][0]).toMatchObject({ country: 'UA' })
  })

  it('creates a project in Spain when Spain is chosen', async () => {
    render(<CreateProjectModal open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('pages.projects.modals.create.projectName'), {
      target: { value: 'Cartera Madrid' },
    })
    fireEvent.change(screen.getByLabelText('pages.projects.modals.create.projectCode'), {
      target: { value: 'MAD' },
    })
    fireEvent.click(spain())
    fireEvent.submit(document.getElementById('create-project-form') as HTMLFormElement)

    await waitFor(() => expect(createProject).toHaveBeenCalled())
    expect(createProject.mock.calls[0][0]).toMatchObject({ country: 'ES' })
  })

  it('sends a changed country when editing', async () => {
    render(<EditProjectModal project={project} open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.click(spain())
    fireEvent.submit(document.getElementById('edit-project-form') as HTMLFormElement)

    await waitFor(() => expect(updateProject).toHaveBeenCalled())
    expect(updateProject.mock.calls[0][0]).toEqual({ id: 7, data: { country: 'ES' } })
  })

  it('leaves the country out when it did not change', async () => {
    render(<EditProjectModal project={project} open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('Cartera Madrid'), {
      target: { value: 'Cartera Madrid Centro' },
    })
    fireEvent.submit(document.getElementById('edit-project-form') as HTMLFormElement)

    await waitFor(() => expect(updateProject).toHaveBeenCalled())
    expect(updateProject.mock.calls[0][0].data).not.toHaveProperty('country')
  })
})
