import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserAvatar } from '../UserAvatar'

describe('UserAvatar', () => {
  it('shows the photo when there is one', () => {
    render(<UserAvatar fullName="Olena Kovalchuk" avatarUrl="/avatars/1.png" />)
    expect(screen.getByRole('img', { name: 'Olena Kovalchuk' })).toHaveAttribute(
      'src',
      '/avatars/1.png'
    )
  })

  it('shows initials when there is no photo', () => {
    render(<UserAvatar firstName="Olena" lastName="Kovalchuk" />)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('falls back to initials when the photo fails to load', () => {
    render(<UserAvatar firstName="Olena" lastName="Kovalchuk" avatarUrl="/avatars/gone.png" />)

    fireEvent.error(screen.getByRole('img', { name: 'Olena Kovalchuk' }))

    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('takes its colours from the theme rather than carrying its own', () => {
    const { container } = render(<UserAvatar firstName="Olena" lastName="Kovalchuk" />)
    const monogram = container.querySelector('span')

    expect(monogram?.className).toContain('bg-muted')
    expect(monogram?.className).toContain('text-muted-foreground')
    expect(monogram?.getAttribute('style')).not.toContain('background-color')
  })

  it('is announced by name to assistive tech', () => {
    render(<UserAvatar firstName="Olena" lastName="Kovalchuk" />)
    expect(screen.getByRole('img', { name: 'Olena Kovalchuk' })).toBeInTheDocument()
  })
})
