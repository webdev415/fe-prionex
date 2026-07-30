import { describe, it, expect, vi } from 'vitest'
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
  const onSend = vi.fn()
  const onChange = vi.fn()
  const onMailboxChange = vi.fn()
  render(
    <ReplyComposer
      mailboxes={mailboxes}
      selectedMailboxId="mb-1"
      onMailboxChange={onMailboxChange}
      toMailbox="client@example.com"
      value=""
      onChange={onChange}
      onSend={onSend}
      {...overrides}
    />
  )
  return { onSend, onChange, onMailboxChange }
}

describe('ReplyComposer — EDO registration selector removed', () => {
  it('renders no EDO / ВИХ / НБУ registration-mode control', () => {
    renderComposer()

    // The composer no longer exposes a registration-mode dropdown: replies are
    // always registered, so none of the old EDO labels/badges must be present.
    expect(screen.queryByText('EDO')).not.toBeInTheDocument()
    expect(screen.queryByText('ВИХ')).not.toBeInTheDocument()
    expect(screen.queryByText('НБУ')).not.toBeInTheDocument()
    expect(screen.queryByText('Outgoing (ВИХ)')).not.toBeInTheDocument()
    expect(screen.queryByText('Do not register')).not.toBeInTheDocument()
  })

  it('still renders the reply-from route and send control', () => {
    renderComposer()
    expect(screen.getByText('legal@prionex.ua')).toBeInTheDocument()
    expect(screen.getByText('client@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('disables send when the draft is empty and calls onSend when there is text', async () => {
    const user = userEvent.setup()
    const { onSend } = renderComposer({ value: 'Reply body' })

    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeEnabled()
    await user.click(send)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('keeps send disabled with an empty draft', () => {
    const { onSend } = renderComposer({ value: '   ' })
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(onSend).not.toHaveBeenCalled()
  })
})
