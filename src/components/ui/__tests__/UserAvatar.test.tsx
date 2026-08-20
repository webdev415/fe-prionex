import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserAvatar } from '../UserAvatar'
import { monogramSwatch } from '@/lib/avatarMonogram'

describe('UserAvatar', () => {
  it('shows the photo when there is one', () => {
    render(<UserAvatar userId={1} fullName="Olena Kovalchuk" avatarUrl="/avatars/1.png" />)
    expect(screen.getByRole('img', { name: 'Olena Kovalchuk' })).toHaveAttribute(
      'src',
      '/avatars/1.png'
    )
  })

  it('shows initials when there is no photo', () => {
    render(<UserAvatar userId={1} firstName="Olena" lastName="Kovalchuk" />)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('falls back to initials when the photo fails to load', () => {
    render(
      <UserAvatar userId={1} firstName="Olena" lastName="Kovalchuk" avatarUrl="/avatars/gone.png" />
    )

    fireEvent.error(screen.getByRole('img', { name: 'Olena Kovalchuk' }))

    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('colours the monogram from the user id, not the name', () => {
    const { container } = render(<UserAvatar userId={3} firstName="A" lastName="B" />)
    const swatch = container.querySelector('span')

    expect(swatch).toHaveStyle({ backgroundColor: monogramSwatch(3).background })
  })

  it('gives two users with the same initials different colours', () => {
    const first = render(<UserAvatar userId={1} firstName="Olena" lastName="Kovalchuk" />)
    const second = render(<UserAvatar userId={2} firstName="Oleh" lastName="Kravets" />)

    const colourOf = (r: ReturnType<typeof render>) =>
      r.container.querySelector('span')?.getAttribute('style')

    expect(colourOf(first)).not.toBe(colourOf(second))
  })

  it('is announced by name to assistive tech', () => {
    render(<UserAvatar userId={1} firstName="Olena" lastName="Kovalchuk" />)
    expect(screen.getByRole('img', { name: 'Olena Kovalchuk' })).toBeInTheDocument()
  })
})
