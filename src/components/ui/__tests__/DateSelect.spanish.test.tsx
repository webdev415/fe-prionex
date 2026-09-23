import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/lib/i18n'
import { DateSelect } from '../DateSelect'

const mutableI18n = i18n as unknown as { language: string }

describe('DateSelect in a Spanish interface', () => {
  beforeEach(() => {
    mutableI18n.language = 'es'
  })
  afterEach(() => {
    mutableI18n.language = 'en'
  })

  it('shows and accepts typed dates as dd/mm/yyyy', async () => {
    const onChange = vi.fn()
    render(
      <DateSelect allowManualInput format="dd.MM.yyyy" value="2026-08-05" onChange={onChange} />
    )

    const input = screen.getByDisplayValue('05/08/2026')
    await userEvent.clear(input)
    await userEvent.type(input, '15062026')

    expect(input).toHaveValue('15/06/2026')
    expect(onChange).toHaveBeenLastCalledWith({ value: new Date(2026, 5, 15) })
  })

  it('shows a Spanish placeholder for typed dates', () => {
    render(<DateSelect allowManualInput format="dd.MM.yyyy" />)

    expect(screen.getByPlaceholderText('DD/MM/AAAA')).toBeInTheDocument()
  })

  it('shows calendar-only dates as dd/mm/yyyy', () => {
    render(<DateSelect format="dd.MM.yyyy" value="2026-08-05" />)

    expect(screen.getByDisplayValue('05/08/2026')).toBeInTheDocument()
  })
})
