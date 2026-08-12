import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '../Input'

// KAN-1009: Chrome offered profile suggestions over every field built on the
// shared Input, because the component shipped no autocomplete attribute, no
// name and none of the password-manager opt-outs. These lock in the defence
// and, just as importantly, the one exemption the login form depends on.

describe('Input (autofill defence)', () => {
  it('defaults to the token Chrome honours on profile fields', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'new-password')
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
    expect(screen.getByRole('textbox').getAttribute('name')).toMatch(/^fld-[A-Za-z0-9_-]+$/)
  })

  it('keeps a caller-supplied name', () => {
    render(<Input name="username" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'username')
  })

  it('keeps a caller-supplied id and its label association', () => {
    render(<Input id="hex-input" label="Colour" />)
    expect(screen.getByLabelText('Colour')).toHaveAttribute('id', 'hex-input')
  })

  it('still defends a call site that asks for plain off', () => {
    render(<Input autoComplete="off" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('data-lpignore', 'true')
  })

  // The shape used by the user, seller and project forms: a semantic id and a
  // react-hook-form name Chrome reads as a profile field. Nothing there passes
  // autoComplete, so the component default is the only thing standing between
  // those fields and the dropdown.
  it('defends a field whose id and name both name a profile group', () => {
    render(<Input id="email" name="email" type="email" label="Email" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toHaveAttribute('data-lpignore', 'true')
    expect(input).toHaveAttribute('name', 'email')
  })

  // ProfileSettingsPage's shape: no id, no name, only a visible label. It is
  // not in this PR's diff, so this is the standing proof that the default
  // covers it rather than the file having been missed.
  it('defends a profile field carrying nothing but its label', () => {
    render(<Input label="Phone" />)
    const input = screen.getByLabelText('Phone')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toHaveAttribute('data-lpignore', 'true')
    expect(input.getAttribute('name')).toMatch(/^fld-[A-Za-z0-9_-]+$/)
  })

  it('lets a call site override an opt-out attribute', () => {
    render(<Input data-form-type="amount" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('data-form-type', 'amount')
    expect(input).toHaveAttribute('data-lpignore', 'true')
  })
})

describe('Input (which tokens count as asking for real autofill)', () => {
  it('stands down for the login form username', () => {
    render(<Input autoComplete="username" name="username" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'username')
    expect(input).not.toHaveAttribute('data-lpignore')
    expect(input).not.toHaveAttribute('data-1p-ignore')
    expect(input).not.toHaveAttribute('data-form-type')
  })

  // The four 2FA components pass one-time-code. Opt-outs there would break the
  // SMS handoff, which is the whole point of the token.
  it('stands down for the 2FA one-time-code fields', () => {
    render(<Input autoComplete="one-time-code" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'one-time-code')
    expect(input).not.toHaveAttribute('data-lpignore')
    expect(input.getAttribute('name')).toBeNull()
  })

  // The allow-list is written the safe way round: anything unrecognised keeps
  // the defence rather than silently dropping it.
  it.each(['none', 'nope', 'section-billing new-password', 'street-address', ''])(
    'keeps defending under %o',
    (token) => {
      render(<Input autoComplete={token} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-lpignore', 'true')
      expect(input.getAttribute('name')).toMatch(/^fld-[A-Za-z0-9_-]+$/)
    }
  )
})
