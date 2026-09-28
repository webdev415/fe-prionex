import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateProjectModal } from '../CreateProjectModal'

const mutateAsync = vi.hoisted(() => vi.fn().mockResolvedValue({}))

vi.mock('@/features/projects/hooks/useProjectMutations', () => ({
  useCreateProject: () => ({ mutateAsync, isPending: false, isError: false }),
}))

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('pages.projects.modals.create.projectName'), {
    target: { value: 'Cartera España' },
  })
  fireEvent.change(screen.getByLabelText('pages.projects.modals.create.projectCode'), {
    target: { value: 'ES_01' },
  })
}

function submit() {
  fireEvent.submit(document.getElementById('create-project-form') as HTMLFormElement)
}

describe('CreateProjectModal currency', () => {
  it('creates projects in hryvnia by default', async () => {
    render(<CreateProjectModal open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fillRequiredFields()
    submit()

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ currency: 'UAH' })
  })

  it('creates a project in euros when euro is chosen', async () => {
    render(<CreateProjectModal open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fillRequiredFields()
    fireEvent.click(screen.getByRole('radio', { name: 'pages.projects.modals.currency.EUR' }))
    submit()

    await waitFor(() =>
      expect(mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ currency: 'EUR' })
    )
  })

  it('creates a project in Canadian dollars in Canada when both are chosen', async () => {
    render(<CreateProjectModal open onClose={vi.fn()} onSuccess={vi.fn()} />)
    fillRequiredFields()
    fireEvent.click(screen.getByRole('radio', { name: 'pages.projects.modals.currency.CAD' }))
    fireEvent.click(screen.getByRole('radio', { name: 'pages.projects.modals.country.CA' }))
    submit()

    await waitFor(() =>
      expect(mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ currency: 'CAD', country: 'CA' })
    )
  })

  it('lets both choice groups wrap a third option onto the next row', () => {
    render(<CreateProjectModal open onClose={vi.fn()} onSuccess={vi.fn()} />)
    const groups = screen.getAllByRole('radiogroup')

    expect(groups).toHaveLength(2)
    groups.forEach((group, index) => {
      expect(
        group,
        `radio group ${index} has no flex-wrap: a third option does not wrap`
      ).toHaveClass('flex-wrap')
    })
  })
})
