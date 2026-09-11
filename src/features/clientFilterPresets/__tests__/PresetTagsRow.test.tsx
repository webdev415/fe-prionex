/**
 * Tags are the one row with two output keys, and the trap is the empty group: a
 * preset that only excludes tags must not save an empty include list, because
 * the client list sends `[]` and an absent key differently.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PresetTagsRow } from '../components/PresetTagsRow'

const OPTIONS = [
  { value: 1, label: 'Promise kept' },
  { value: 2, label: 'Do not call' },
]

function Harness({
  onChange,
}: {
  onChange: (next: { include?: number[]; exclude?: number[] }) => void
}) {
  const [state, setState] = useState<{ include?: number[]; exclude?: number[] }>({})
  return (
    <PresetTagsRow
      label="Tags"
      options={OPTIONS}
      include={state.include}
      exclude={state.exclude}
      onChange={(next) => {
        setState(next)
        onChange(next)
      }}
    />
  )
}

describe('PresetTagsRow', () => {
  it('cycles a tag through include, exclude and back to neutral', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const tag = screen.getByRole('checkbox', { name: 'Promise kept' })

    await user.click(tag)
    expect(onChange).toHaveBeenLastCalledWith({ include: [1], exclude: undefined })

    await user.click(tag)
    // Moved between groups in one click — not added to both.
    expect(onChange).toHaveBeenLastCalledWith({ include: undefined, exclude: [1] })

    await user.click(tag)
    expect(onChange).toHaveBeenLastCalledWith({ include: undefined, exclude: undefined })
  })

  it('keeps the two groups independent', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Promise kept' }))
    await user.click(screen.getByRole('checkbox', { name: 'Do not call' }))
    await user.click(screen.getByRole('checkbox', { name: 'Do not call' }))

    expect(onChange).toHaveBeenLastCalledWith({ include: [1], exclude: [2] })
  })

  it('reflects the state it was given', () => {
    render(
      <PresetTagsRow
        label="Tags"
        options={OPTIONS}
        include={[1]}
        exclude={[2]}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'Promise kept' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    // "mixed" is how the tri-state control reports exclusion.
    expect(screen.getByRole('checkbox', { name: 'Do not call' })).toHaveAttribute(
      'aria-checked',
      'mixed'
    )
  })

  it('says so when the project has no tags', () => {
    render(<PresetTagsRow label="Tags" options={[]} onChange={vi.fn()} />)

    expect(screen.getByText('pages.profile.presets.tags.none')).toBeTruthy()
    expect(screen.queryByTestId('preset-tags')).toBeNull()
  })
})
