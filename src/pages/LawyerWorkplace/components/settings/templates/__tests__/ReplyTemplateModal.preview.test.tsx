import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/lib/i18n'
import { setActiveCurrency } from '@/lib/projectCurrency'
import { ReplyTemplateModal } from '../ReplyTemplateModal'

const i18nState = vi.hoisted(() => ({ language: 'es' }))

vi.mock('react-i18next', () => {
  const t = (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key)
  const i18n = {
    get language() {
      return i18nState.language
    },
    changeLanguage: vi.fn(),
  }
  return {
    useTranslation: () => ({ t, i18n }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

const BODY = '{{clientName}} / {{clientTaxId}} / {{senderName}} / {{debtAmount}} / {{dueDate}}'

async function previewOf(body: string) {
  const user = userEvent.setup()
  render(
    <ReplyTemplateModal open template={null} letterTypes={[]} onClose={vi.fn()} onSave={vi.fn()} />
  )
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  fireEvent.change(screen.getByPlaceholderText('Write the letter template text...'), {
    target: { value: body },
  })
  await user.click(screen.getByRole('button', { name: 'Preview with sample data' }))
}

describe('ReplyTemplateModal preview sample', () => {
  afterEach(() => {
    i18nState.language = 'es'
    ;(i18n as unknown as { language: string }).language = 'en'
    setActiveCurrency('UAH')
  })

  it('fills a Spanish template with Spanish sample values', async () => {
    setActiveCurrency('EUR')
    ;(i18n as unknown as { language: string }).language = 'es'

    await previewOf(BODY)

    expect(
      screen.getByText(
        'García López, Lucía / 12345678Z / Banco de España / 12.500,00 € / 15/08/2026'
      )
    ).toBeInTheDocument()
  })

  it('keeps the Ukrainian sample values for a Ukrainian lawyer', async () => {
    i18nState.language = 'uk'

    await previewOf(BODY)

    expect(
      screen.getByText(
        'Іваненко Іван Іванович / 1234567890 / Національний банк України / 12 500,00 грн / 15.08.2026'
      )
    ).toBeInTheDocument()
  })
})
