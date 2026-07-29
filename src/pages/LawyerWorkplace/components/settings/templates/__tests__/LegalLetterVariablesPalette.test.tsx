import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LegalLetterVariablesPalette } from '../LegalLetterVariablesPalette'

// Standard i18n mock: `t(key, fallback)` returns the fallback string when given,
// otherwise the key. Group headers fall back to the group id, labels to the
// variable name, descriptions to '' — enough to assert structure deterministically.
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      i18n: { language: 'uk' },
    }),
  }
})

describe('LegalLetterVariablesPalette', () => {
  it('renders all 16 variables as insertable chips', () => {
    render(<LegalLetterVariablesPalette onInsert={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(16)
  })

  it('renders the four variable groups as headers', () => {
    render(<LegalLetterVariablesPalette onInsert={vi.fn()} />)
    for (const group of ['client', 'incoming', 'reply', 'company']) {
      expect(screen.getByText(group, { exact: true })).toBeInTheDocument()
    }
  })

  it('shows the {{token}} for each variable', () => {
    render(<LegalLetterVariablesPalette onInsert={vi.fn()} />)
    expect(screen.getByText('{{clientName}}')).toBeInTheDocument()
    expect(screen.getByText('{{outNo}}')).toBeInTheDocument()
    expect(screen.getByText('{{companyPhone}}')).toBeInTheDocument()
  })

  it('inserts the variable name when a chip is clicked', async () => {
    const onInsert = vi.fn()
    const user = userEvent.setup()
    render(<LegalLetterVariablesPalette onInsert={onInsert} />)

    await user.click(screen.getByText('{{clientTaxId}}'))
    expect(onInsert).toHaveBeenCalledWith('clientTaxId')
  })

  it('disables all chips when disabled', () => {
    render(<LegalLetterVariablesPalette onInsert={vi.fn()} disabled />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })
})
