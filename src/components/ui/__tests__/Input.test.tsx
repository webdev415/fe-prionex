import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '../Input'

// KAN-1009: Chrome offered profile suggestions over every field built on the
// shared Input, because the component shipped no autocomplete attribute, no
// name and none of the password-manager opt-outs. These lock in the defence
// and, just as importantly, the exemption the login form depends on.

describe('Input (autofill defence)', () => {
  it('defaults to off', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'off')
  })

  it('carries the password-manager opt-outs', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('data-lpignore', 'true')
    expect(input).toHaveAttribute('data-1p-ignore', '')
    expect(input).toHaveAttribute('data-form-type', 'other')
  })

  it('gives an unnamed field a name with nothing in it to classify', () => {
    render(<Input />)
    const name = screen.getByRole('textbox').getAttribute('name')
    expect(name).toMatch(/^fld-[A-Za-z0-9_-]+$/)
  })

  it('keeps a caller-supplied name', () => {
    render(<Input name="username" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'username')
  })

  it('keeps a caller-supplied id and its label association', () => {
    render(<Input id="hex-input" label="Colour" />)
    const input = screen.getByLabelText('Colour')
    expect(input).toHaveAttribute('id', 'hex-input')
  })

  it('lets a profile-classified call site ask for the stronger token', () => {
    render(<Input autoComplete="new-password" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toHaveAttribute('data-lpignore', 'true')
  })

  it('stands down when the call site wants real autofill', () => {
    render(<Input autoComplete="username" name="username" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'username')
    expect(input).not.toHaveAttribute('data-lpignore')
    expect(input).not.toHaveAttribute('data-1p-ignore')
    expect(input).not.toHaveAttribute('data-form-type')
  })

  it('does not invent a name for a field that wants real autofill', () => {
    render(<Input autoComplete="email" />)
    expect(screen.getByRole('textbox').getAttribute('name')).toBeNull()
  })
})
