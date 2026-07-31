import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CallProgressRing } from '../CallProgressRing'

describe('CallProgressRing', () => {
  it('renders the rounded percentage label', () => {
    render(<CallProgressRing percent={15} />)
    expect(screen.getByText('15%')).toBeInTheDocument()
  })

  it('clamps out-of-range values', () => {
    const { rerender } = render(<CallProgressRing percent={-10} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    rerender(<CallProgressRing percent={250} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
