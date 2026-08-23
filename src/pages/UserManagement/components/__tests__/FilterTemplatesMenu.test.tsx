import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const saveMutate = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const deleteMutate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const templates = vi.hoisted(() => ({ value: [] as unknown[] }))
const toastFns = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('sonner', () => ({ toast: toastFns }))
vi.mock('@/features/users/hooks/useFilterTemplates', () => ({
  useFilterTemplates: () => ({ data: { templates: templates.value } }),
  useSaveFilterTemplate: () => ({ mutateAsync: saveMutate, isPending: false }),
  useUpdateFilterTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteFilterTemplate: () => ({ mutateAsync: deleteMutate, isPending: false }),
}))

const { FilterTemplatesMenu } = await import('../FilterTemplatesMenu')

function openMenu() {
  const trigger = screen.getByRole('button', { name: /templates/i })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(trigger)
}

const CURRENT = { work_format: 'remote', page_size: 10 }

describe('FilterTemplatesMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    templates.value = []
  })

  it('says so when nothing has been saved yet', async () => {
    render(<FilterTemplatesMenu currentFilters={CURRENT} onApply={vi.fn()} />)
    openMenu()

    expect(await screen.findByText(/no saved templates yet/i)).toBeInTheDocument()
  })

  it('saves the filters it was given, under the name typed', async () => {
    render(<FilterTemplatesMenu currentFilters={CURRENT} onApply={vi.fn()} />)
    openMenu()
    fireEvent.click(await screen.findByText(/save current filters/i))

    fireEvent.change(await screen.findByLabelText(/template name/i), {
      target: { value: '  Remote lawyers  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    await waitFor(() =>
      expect(saveMutate).toHaveBeenCalledWith({ name: 'Remote lawyers', filters: CURRENT })
    )
  })

  it('will not save a nameless template', async () => {
    render(<FilterTemplatesMenu currentFilters={CURRENT} onApply={vi.fn()} />)
    openMenu()
    fireEvent.click(await screen.findByText(/save current filters/i))

    fireEvent.change(await screen.findByLabelText(/template name/i), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('button', { name: 'actions.save' })).toBeDisabled()
    expect(saveMutate).not.toHaveBeenCalled()
  })

  it('hands the chosen template back to the page', async () => {
    const template = { id: 7, name: 'Remote', filters: { work_format: 'remote' }, created_at: '' }
    templates.value = [template]
    const onApply = vi.fn()
    render(<FilterTemplatesMenu currentFilters={CURRENT} onApply={onApply} />)
    openMenu()

    fireEvent.click(await screen.findByText('Remote'))

    expect(onApply).toHaveBeenCalledWith(template)
  })

  it('asks before deleting one', async () => {
    templates.value = [{ id: 7, name: 'Remote', filters: {}, created_at: '' }]
    render(<FilterTemplatesMenu currentFilters={CURRENT} onApply={vi.fn()} />)
    openMenu()

    fireEvent.click(await screen.findByRole('button', { name: /delete remote/i }))

    expect(await screen.findByText(/delete this template\?/i)).toBeInTheDocument()
    expect(deleteMutate).not.toHaveBeenCalled()
  })

  it('deletes once the question is answered', async () => {
    templates.value = [{ id: 7, name: 'Remote', filters: {}, created_at: '' }]
    render(<FilterTemplatesMenu currentFilters={CURRENT} onApply={vi.fn()} />)
    openMenu()
    fireEvent.click(await screen.findByRole('button', { name: /delete remote/i }))

    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(7))
  })

  it('applying is not the same click as deleting', async () => {
    templates.value = [{ id: 7, name: 'Remote', filters: {}, created_at: '' }]
    const onApply = vi.fn()
    render(<FilterTemplatesMenu currentFilters={CURRENT} onApply={onApply} />)
    openMenu()

    fireEvent.click(await screen.findByRole('button', { name: /delete remote/i }))

    expect(onApply).not.toHaveBeenCalled()
  })
})
