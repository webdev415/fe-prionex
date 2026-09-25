import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { expectObscured } from '@/test/piiHelpers'
import { PromiseAssignDialog } from '../PromiseAssignDialog'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/tags/api/tagsApi', () => ({
  assignTagExtended: vi.fn().mockResolvedValue(undefined),
}))

function renderDialog() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PromiseAssignDialog
        open
        clientId={42}
        clientName="Test Client"
        tagId={7}
        tagName="Promise To Pay"
        onClose={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('PromiseAssignDialog texts', () => {
  it('renders no hard-coded Cyrillic text', () => {
    renderDialog()

    expect(
      screen.getByText(/pages\.clients\.modals\.promiseAssign\.titlePrefix/)
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[Ѐ-ӿ]/)
  })

  it('keeps the client name in the heading obscured', () => {
    renderDialog()

    expectObscured(screen.getByText('Test Client'))
  })

  it('confirms the assignment with a translated message', async () => {
    renderDialog()

    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    const message = vi.mocked(toast.success).mock.calls[0][0] as ReactElement
    const toastBody = within(render(message).container)

    expect(
      toastBody.getByText(/pages\.clients\.modals\.promiseAssign\.assignedPrefix/)
    ).toBeInTheDocument()
    expectObscured(toastBody.getByText('Test Client'))
  })
})
