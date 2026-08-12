import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../Input'

// The opt-in "×" and its accessible name, mirroring DateSelect's clear-button
// coverage: the default name is what ~100 existing call sites render, so it is
// pinned here, and the per-field override is opt-in on top of it.

describe('Input (clear button)', () => {
  it('names the × "Clear" by default', async () => {
    const onClear = vi.fn()
    render(<Input value="7" onChange={() => {}} onClear={onClear} />)

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('uses the opt-in clearLabel as the accessible name', async () => {
    // Opt-in per-field name for forms with several clearable fields side by side.
    const onClear = vi.fn()
    render(
      <Input
        value="7"
        onChange={() => {}}
        onClear={onClear}
        clearLabel="Clear the verifications cap"
      />
    )

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear the verifications cap' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
