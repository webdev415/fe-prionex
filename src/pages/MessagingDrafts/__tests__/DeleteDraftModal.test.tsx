/**
 * The draft delete modal has to describe what the backend actually does.
 *
 * DELETE /api/v1/messaging/drafts/{id} soft-deletes: the row stays, carrying
 * is_deleted/deleted_at/deleted_by, and a purge job removes it only after the
 * retention window. The modal used to promise "This action cannot be undone /
 * The draft will be permanently removed", which told users recoverable data
 * was gone and left the recovery path unused.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { MessagingDraft } from '@/features/messaging'

const deleteMutateAsync = vi.hoisted(() => vi.fn())
const isPending = vi.hoisted(() => ({ value: false }))

vi.mock('@/features/messaging', async () => {
  const actual =
    await vi.importActual<typeof import('@/features/messaging')>('@/features/messaging')
  return {
    ...actual,
    useDeleteMessagingDraft: () => ({
      mutateAsync: deleteMutateAsync,
      isPending: isPending.value,
    }),
  }
})

const { DeleteDraftModal } = await import('../DeleteDraftModal')

const draft = {
  id: 7,
  name: 'Overdue reminder',
  channel: 'sms',
  body: 'hello',
} as unknown as MessagingDraft

function renderModal(overrides: Partial<React.ComponentProps<typeof DeleteDraftModal>> = {}) {
  const onClose = vi.fn()
  render(<DeleteDraftModal draft={draft} open onClose={onClose} {...overrides} />)
  return { onClose }
}

describe('DeleteDraftModal', () => {
  beforeEach(() => {
    deleteMutateAsync.mockReset().mockResolvedValue(undefined)
    isPending.value = false
  })

  it('tells the user the draft goes to Trash', () => {
    renderModal()
    expect(screen.getByText('The draft will be moved to Trash')).toBeInTheDocument()
    expect(screen.getByText(/can restore it from Trash/)).toBeInTheDocument()
  })

  it('never claims the deletion is permanent or irreversible', () => {
    renderModal()
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/permanently removed/i)).not.toBeInTheDocument()
  })

  it('names the draft being deleted', () => {
    renderModal()
    expect(screen.getByText(/Overdue reminder/)).toBeInTheDocument()
  })

  it('deletes the draft and closes', async () => {
    const { onClose } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith(7))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('stays open when the delete fails', async () => {
    deleteMutateAsync.mockRejectedValue(new Error('offline'))
    const { onClose } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders nothing without a draft', () => {
    const { container } = render(<DeleteDraftModal draft={null} open onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
