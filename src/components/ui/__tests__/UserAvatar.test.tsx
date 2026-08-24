/**
 * The photo endpoint requires a token, so the bytes cannot travel in src - the
 * browser would issue that request itself and send no Authorization header.
 * What these pin is that the component asks the API client for the photo, at
 * the API host, and only ever renders what it got back.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const loadAvatarObjectUrl = vi.hoisted(() => vi.fn())

vi.mock('@/lib/avatarImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/avatarImage')>()
  return { ...actual, loadAvatarObjectUrl }
})

const { forgetAvatar } = await import('@/lib/avatarImage')

const { UserAvatar } = await import('../UserAvatar')

describe('UserAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadAvatarObjectUrl.mockResolvedValue('blob:fake-object-url')
  })

  it('fetches a server-relative photo from the API host, not the page origin', async () => {
    render(<UserAvatar fullName="Olena Kovalchuk" avatarUrl="/api/v1/users/avatars/1.png" />)

    await waitFor(() =>
      expect(loadAvatarObjectUrl).toHaveBeenCalledWith(
        'https://api.dev.crm-prionex.online/api/v1/users/avatars/1.png'
      )
    )
  })

  it('renders a photo from another host directly, without our credentials', async () => {
    // The API client attaches the session token and cookies to whatever host it
    // is given, so a foreign avatar_url must not go through it.
    const { container } = render(
      <UserAvatar fullName="Olena Kovalchuk" avatarUrl="https://cdn.example.com/1.png" />
    )

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/1.png')
    expect(loadAvatarObjectUrl).not.toHaveBeenCalled()
  })

  it('renders what the client fetched, never the path itself', async () => {
    // Queried by tag, not by role: the monogram is also role="img" with the
    // same name, so a role query matches it before the photo has arrived.
    const { container } = render(
      <UserAvatar fullName="Olena Kovalchuk" avatarUrl="/api/v1/users/avatars/1.png" />
    )

    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute('src', 'blob:fake-object-url')
    )
  })

  it('asks for nothing when there is no photo', () => {
    render(<UserAvatar firstName="Olena" lastName="Kovalchuk" />)

    expect(loadAvatarObjectUrl).not.toHaveBeenCalled()
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('shows initials while the photo is still being fetched', () => {
    loadAvatarObjectUrl.mockReturnValue(new Promise(() => {}))
    render(<UserAvatar firstName="Olena" lastName="Kovalchuk" avatarUrl="/avatars/1.png" />)

    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('falls back to initials when the photo cannot be fetched', async () => {
    // A 401 from an expired session looks like this.
    loadAvatarObjectUrl.mockRejectedValue(new Error('Request failed with status code 401'))
    render(<UserAvatar firstName="Olena" lastName="Kovalchuk" avatarUrl="/avatars/gone.png" />)

    await waitFor(() => expect(loadAvatarObjectUrl).toHaveBeenCalled())
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it("does not show one person's photo under another's name", async () => {
    const { container, rerender } = render(
      <UserAvatar fullName="Olena Kovalchuk" avatarUrl="/api/v1/users/avatars/1.png" />
    )
    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument())

    loadAvatarObjectUrl.mockReturnValue(new Promise(() => {}))
    rerender(<UserAvatar fullName="Petro Ivanenko" avatarUrl="/api/v1/users/avatars/2.png" />)

    // The first photo must not linger under the second name while it loads.
    expect(screen.getByText('PI')).toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('falls back to initials when the browser cannot render the photo', async () => {
    // A foreign photo is handed to the tag directly, so it can still fail after
    // we let go of it. Without an onError the browser draws its own
    // broken-image icon, which says less than the initials do.
    const { container } = render(
      <UserAvatar fullName="Olena Kovalchuk" avatarUrl="https://cdn.example.com/gone.png" />
    )
    const img = container.querySelector('img') as HTMLImageElement

    fireEvent.error(img)

    await waitFor(() => expect(container.querySelector('img')).not.toBeInTheDocument())
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('re-fetches a replaced photo that kept the same url', async () => {
    // The URL alone cannot say whether what is held is still current, so
    // forgetting has to reach the component or it would keep showing bytes it
    // was told to drop - or, once revoked, a broken image.
    const { container } = render(
      <UserAvatar fullName="Olena Kovalchuk" avatarUrl="/api/v1/users/avatars/1.png" />
    )
    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument())
    expect(loadAvatarObjectUrl).toHaveBeenCalledTimes(1)

    loadAvatarObjectUrl.mockResolvedValue('blob:the-new-photo')
    act(() => forgetAvatar('https://api.dev.crm-prionex.online/api/v1/users/avatars/1.png'))

    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute('src', 'blob:the-new-photo')
    )
    expect(loadAvatarObjectUrl).toHaveBeenCalledTimes(2)
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
