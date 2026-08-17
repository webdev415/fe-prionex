/**
 * The template delete modal has to describe what the backend actually does.
 *
 * DELETE /api/v1/sms/templates/{id} soft-deletes - the router's own docstring
 * says "the row stays in the database" - and a purge job removes it only after
 * the retention window. The modal used to promise "This action cannot be undone
 * / The template will be permanently removed from the system", which told users
 * recoverable data was gone and left the recovery path unused.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const deleteMutateAsync = vi.hoisted(() => vi.fn())
const templateResponse = vi.hoisted(() => ({
  value: {
    id: 4,
    name: 'Payment reminder',
    message_text: 'hello',
    category: 'reminder',
    is_active: true,
    project_id: 1,
  } as Record<string, unknown> | null,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/features/sms', async () => {
  const actual = await vi.importActual<typeof import('@/features/sms')>('@/features/sms')
  return {
    ...actual,
    useDeleteTemplate: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
    useSMSTemplate: () => ({ data: templateResponse.value }),
  }
})

const { DeleteTemplateModal } = await import('../DeleteTemplateModal')

function renderModal() {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  render(<DeleteTemplateModal open templateId={4} onClose={onClose} onSuccess={onSuccess} />)
  return { onClose, onSuccess }
}

describe('DeleteTemplateModal', () => {
  beforeEach(() => {
    deleteMutateAsync.mockReset().mockResolvedValue(undefined)
    templateResponse.value = {
      id: 4,
      name: 'Payment reminder',
      message_text: 'hello',
      category: 'reminder',
      is_active: true,
      project_id: 1,
    }
  })

  it('tells the user the template is recoverable', () => {
    renderModal()
    expect(
      screen.getByText('The template will be removed from the active list')
    ).toBeInTheDocument()
    expect(screen.getByText(/can restore it if this was a mistake/)).toBeInTheDocument()
  })

  it('never claims the deletion is permanent or irreversible', () => {
    renderModal()
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/permanently removed/i)).not.toBeInTheDocument()
  })

  it('deletes the template and reports success', async () => {
    const { onSuccess } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith(4))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('does not report success when the delete fails', async () => {
    deleteMutateAsync.mockRejectedValue(new Error('offline'))
    const { onSuccess } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalled())
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('renders nothing until the template loads', () => {
    templateResponse.value = null
    const { container } = render(
      <DeleteTemplateModal open templateId={4} onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
