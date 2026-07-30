import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LegalMailbox } from '@/features/lawyerWorkplace/api/types'
import { ReplyComposer } from '../ReplyComposer'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>) =>
        typeof fallback === 'string' ? fallback : key,
      i18n: { language: 'uk' },
    }),
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

// jsdom lacks the pointer-capture APIs Radix menus rely on.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).hasPointerCapture = () => false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).setPointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).releasePointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).scrollIntoView = () => undefined
})

const mailboxes: LegalMailbox[] = [
  {
    id: 'mb-1',
    email: 'legal@prionex.ua',
    display_name: 'Legal',
    status: 'connected',
    is_default_outgoing: true,
  },
]

function renderComposer(overrides: Partial<React.ComponentProps<typeof ReplyComposer>> = {}) {
  const onAttachFromClient = vi.fn()
  const onGenerateDocument = vi.fn()
  const onAttachFiles = vi.fn()
  render(
    <ReplyComposer
      mailboxes={mailboxes}
      selectedMailboxId="mb-1"
      onMailboxChange={vi.fn()}
      toMailbox="client@example.com"
      value="Reply body"
      onChange={vi.fn()}
      onSend={vi.fn()}
      onAttachFiles={onAttachFiles}
      onAttachFromClient={onAttachFromClient}
      onGenerateDocument={onGenerateDocument}
      clientActionsEnabled
      {...overrides}
    />
  )
  return { onAttachFromClient, onGenerateDocument, onAttachFiles }
}

describe('ReplyComposer — attach dropdown with three options', () => {
  it('exposes the three attach options in the dropdown', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.click(screen.getByRole('button', { name: 'Attach' }))

    expect(await screen.findByText('File from computer')).toBeInTheDocument()
    expect(screen.getByText('Attached file on client')).toBeInTheDocument()
    expect(screen.getByText('Generate document')).toBeInTheDocument()
  })

  it('calls onAttachFromClient and onGenerateDocument when picking those options', async () => {
    const user = userEvent.setup()
    const { onAttachFromClient, onGenerateDocument } = renderComposer()

    await user.click(screen.getByRole('button', { name: 'Attach' }))
    await user.click(await screen.findByText('Attached file on client'))
    expect(onAttachFromClient).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Attach' }))
    await user.click(await screen.findByText('Generate document'))
    expect(onGenerateDocument).toHaveBeenCalledTimes(1)
  })

  it('triggers the file input for "File from computer"', async () => {
    const user = userEvent.setup()
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click')
    const { onAttachFromClient, onGenerateDocument } = renderComposer()

    await user.click(screen.getByRole('button', { name: 'Attach' }))
    await user.click(await screen.findByText('File from computer'))

    expect(clickSpy).toHaveBeenCalled()
    expect(onAttachFromClient).not.toHaveBeenCalled()
    expect(onGenerateDocument).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('disables only "Generate document" without a confirmed client, keeping attach available', async () => {
    const user = userEvent.setup()
    // No confirmed letter client, but attach-from-client stays enabled because
    // the picker lets the lawyer search for any client's document.
    const { onAttachFromClient, onGenerateDocument } = renderComposer({
      clientActionsEnabled: false,
    })

    await user.click(screen.getByRole('button', { name: 'Attach' }))
    const clientOption = await screen.findByText('Attached file on client')
    expect(clientOption).not.toHaveAttribute('aria-disabled', 'true')
    await user.click(clientOption)
    expect(onAttachFromClient).toHaveBeenCalledTimes(1)

    // Re-open the (now closed) menu to inspect the generate option.
    await user.click(screen.getByRole('button', { name: 'Attach' }))
    const generateOption = await screen.findByText('Generate document')
    expect(generateOption).toHaveAttribute('aria-disabled', 'true')
    await user.click(generateOption)
    expect(onGenerateDocument).not.toHaveBeenCalled()
  })

  it('disables attach-from-client only when explicitly turned off', async () => {
    const user = userEvent.setup()
    const { onAttachFromClient } = renderComposer({ attachFromClientEnabled: false })

    await user.click(screen.getByRole('button', { name: 'Attach' }))
    const clientOption = await screen.findByText('Attached file on client')
    expect(clientOption).toHaveAttribute('aria-disabled', 'true')

    await user.click(clientOption)
    expect(onAttachFromClient).not.toHaveBeenCalled()
  })
})
