/**
 * Numeric bounds have one trap: 0 is a real filter ("debt of at most 0"), so an
 * empty field and a zero cannot collapse into the same stored value.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PresetNumericRangeRow } from '../components/PresetNumericRangeRow'
import type { NumericRange } from '../types'

function Harness({ onChange }: { onChange: (next: NumericRange | undefined) => void }) {
  const [value, setValue] = useState<NumericRange | undefined>(undefined)
  return (
    <PresetNumericRangeRow
      label="Total debt"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

const fields = () => screen.getAllByRole('spinbutton')

describe('PresetNumericRangeRow', () => {
  it('reports only the bound that was filled in', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(fields()[0], '500')

    expect(onChange).toHaveBeenLastCalledWith({ from: 500 })
  })

  it('keeps both bounds independently', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(fields()[0], '100')
    await user.type(fields()[1], '900')

    expect(onChange).toHaveBeenLastCalledWith({ from: 100, to: 900 })
  })

  it('treats zero as a bound, not as an empty field', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(fields()[1], '0')

    expect(onChange).toHaveBeenLastCalledWith({ to: 0 })
  })

  it('reports the filter as unset once the last bound is cleared', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(fields()[0], '42')
    await user.clear(fields()[0])

    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('clears one bound without losing the other', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(fields()[0], '10')
    await user.type(fields()[1], '20')
    await user.clear(fields()[0])

    expect(onChange).toHaveBeenLastCalledWith({ to: 20 })
  })
})
