import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DateSelect } from '../DateSelect'

describe('DateSelect placeholder', () => {
  it('uses the translated default when no placeholder is given', () => {
    render(<DateSelect format="dd.MM.yyyy" />)

    expect(screen.getByPlaceholderText('components.dateSelect.selectDate')).toBeInTheDocument()
  })

  it('shows the typing mask when manual input has no placeholder', () => {
    render(<DateSelect allowManualInput format="dd.MM.yyyy" />)

    expect(screen.getByPlaceholderText('DD.MM.YYYY')).toBeInTheDocument()
  })

  it('keeps a placeholder passed by the caller', () => {
    render(<DateSelect allowManualInput format="dd.MM.yyyy" placeholder="Promise date" />)

    expect(screen.getByPlaceholderText('Promise date')).toBeInTheDocument()
  })
})
