import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LetterTypeConfig } from '@/pages/LawyerWorkplace/settings/types'

// Stable `t` (same reference across renders) so the modal's populate-effect,
// which depends on `t`, does not re-run and reset typed values. `t(key, fallback)`
// returns the fallback string the component passes, mirroring i18next behaviour.
vi.mock('react-i18next', () => {
  const t = (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key)
  const i18n = { language: 'uk', changeLanguage: vi.fn() }
  return {
    useTranslation: () => ({ t, i18n }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

import { ReplyTemplateModal } from '../ReplyTemplateModal'

const LETTER_TYPES: LetterTypeConfig[] = []

async function flushFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('ReplyTemplateModal subject field', () => {
  it('submits the subject in the form payload', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(
      <ReplyTemplateModal
        open
        template={null}
        letterTypes={LETTER_TYPES}
        onClose={vi.fn()}
        onSave={onSave}
      />
    )
    await flushFrame()

    const subjectInput = screen.getByPlaceholderText('Reply subject (optional)...')
    const bodyInput = screen.getByPlaceholderText('Write the letter template text...')
    const nameInput = screen
      .getAllByRole('textbox')
      .find((el) => !el.getAttribute('placeholder')) as HTMLInputElement

    await user.type(nameInput, 'Standard reply')
    await user.type(subjectInput, 'Тема відповіді')
    await user.type(bodyInput, 'Body text')

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Standard reply',
      subject: 'Тема відповіді',
      body: 'Body text',
    })
  })

  it('inserts a palette variable into the focused subject field', async () => {
    const user = userEvent.setup()
    render(
      <ReplyTemplateModal
        open
        template={null}
        letterTypes={LETTER_TYPES}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )
    await flushFrame()

    const subjectInput = screen.getByPlaceholderText(
      'Reply subject (optional)...'
    ) as HTMLInputElement
    await user.click(subjectInput)
    await user.type(subjectInput, 'Ref ')

    const contractButton = screen.getByText('{{contract}}').closest('button') as HTMLButtonElement
    await user.click(contractButton)

    expect(subjectInput.value).toBe('Ref {{contract}}')
  })
})
