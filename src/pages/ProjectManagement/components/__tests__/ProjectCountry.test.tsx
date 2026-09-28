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

  it('creates a project in Canada when Canada is chosen', async () => {
    render(<CreateProjectModal open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('pages.projects.modals.create.projectName'), {
      target: { value: 'FinBoost legacy' },
    })
    fireEvent.change(screen.getByLabelText('pages.projects.modals.create.projectCode'), {
      target: { value: 'FBLEG' },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'pages.projects.modals.country.CA' }))
    fireEvent.submit(document.getElementById('create-project-form') as HTMLFormElement)

    await waitFor(() => expect(createProject).toHaveBeenCalled())
    expect(createProject.mock.calls[0][0]).toMatchObject({ country: 'CA' })
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

  it('shows a Canadian project as Canada in Canadian dollars and keeps both on a rename', async () => {
    render(
      <EditProjectModal
        project={{ ...project, currency: 'CAD', country: 'CA' }}
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.getByRole('radio', { name: 'pages.projects.modals.currency.CAD' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'pages.projects.modals.country.CA' })).toBeChecked()

    fireEvent.change(screen.getByDisplayValue('Cartera Madrid'), {
      target: { value: 'FinBoost legacy' },
    })
    fireEvent.submit(document.getElementById('edit-project-form') as HTMLFormElement)

    await waitFor(() => expect(updateProject).toHaveBeenCalled())
    const data = updateProject.mock.calls[0][0].data
    expect(data).not.toHaveProperty('currency')
    expect(data).not.toHaveProperty('country')
  })

  it('sends an edited Spanish tax code in capitals', async () => {
    render(<EditProjectModal project={project} open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(document.getElementById('edrpou_code') as HTMLInputElement, {
      target: { value: 'x1234567l' },
    })
    fireEvent.submit(document.getElementById('edit-project-form') as HTMLFormElement)

    await waitFor(() => expect(updateProject).toHaveBeenCalled())
    expect(updateProject.mock.calls[0][0].data.edrpou_code).toBe('X1234567L')
  })

  it('does not resend a tax code that only changed case', async () => {
    render(
      <EditProjectModal
        project={{ ...project, edrpou_code: 'B12345678' }}
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )
    fireEvent.change(document.getElementById('edrpou_code') as HTMLInputElement, {
      target: { value: 'b12345678' },
    })
    fireEvent.change(screen.getByDisplayValue('Cartera Madrid'), {
      target: { value: 'Cartera Madrid Centro' },
    })
    fireEvent.submit(document.getElementById('edit-project-form') as HTMLFormElement)

    await waitFor(() => expect(updateProject).toHaveBeenCalled())
    expect(updateProject.mock.calls[0][0].data).not.toHaveProperty('edrpou_code')
  })
})
