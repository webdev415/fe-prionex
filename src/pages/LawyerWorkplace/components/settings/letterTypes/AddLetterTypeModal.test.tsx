import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddLetterTypeModal } from './AddLetterTypeModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}))

// jsdom lacks the pointer-capture / scroll APIs Radix relies on.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).hasPointerCapture = () => false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).releasePointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).scrollIntoView = () => undefined
})

async function renderModal(onAdd = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn()
  render(<AddLetterTypeModal open onClose={onClose} onAdd={onAdd} />)
  // Flush the requestAnimationFrame-based reset that runs when the modal opens.
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
  const nameInput = screen.getByPlaceholderText('e.g. Payment dispute')
  const codeInput = screen.getByPlaceholderText('e.g. payment_dispute')
  return { onAdd, onClose, nameInput, codeInput }
}

describe('AddLetterTypeModal', () => {
  it('auto-fills the code from the name via Ukrainian transliteration', async () => {
    const user = userEvent.setup()
    const { nameInput, codeInput } = await renderModal()

    await user.type(nameInput, 'Офіційні листи НБУ')

    expect(codeInput).toHaveValue('ofitsiini_lysty_nbu')
  })

  it('does not overwrite the code once it was edited by hand', async () => {
    const user = userEvent.setup()
    const { nameInput, codeInput } = await renderModal()

    await user.type(nameInput, 'Тест')
    expect(codeInput).toHaveValue('test')

    await user.clear(codeInput)
    await user.type(codeInput, 'manual_code')
    // Keep typing into the name — the manually edited code must survive.
    await user.type(nameInput, ' новий')

    expect(codeInput).toHaveValue('manual_code')
  })

  it('submits the code as the letter-type id', async () => {
    const user = userEvent.setup()
    const { onAdd, onClose, nameInput } = await renderModal()

    await user.type(nameInput, 'Офіційні листи НБУ')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledWith({
      nameFallback: 'Офіційні листи НБУ',
      colorId: expect.any(String),
      id: 'ofitsiini_lysty_nbu',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('blocks submit and shows an error for an invalid manual code', async () => {
    const user = userEvent.setup()
    const { onAdd, nameInput, codeInput } = await renderModal()

    await user.type(nameInput, 'Тест')
    await user.clear(codeInput)
    await user.type(codeInput, '123 bad')

    const addButton = screen.getByRole('button', { name: 'Add' })
    expect(addButton).toBeDisabled()
    await user.click(addButton)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
