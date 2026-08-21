/**
 * The photo control on Profile Settings.
 *
 * The client-side type and size checks asserted here are a courtesy, not the
 * guard - the server decides on the file's own bytes. What matters is that a
 * rejected file never reaches the network and never clears the existing photo.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const uploadAvatar = vi.hoisted(() => vi.fn())
const deleteAvatar = vi.hoisted(() => vi.fn())
const refreshUser = vi.hoisted(() => vi.fn())
const toastFns = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('sonner', () => ({ toast: toastFns }))
vi.mock('@/features/auth/api/authApi', () => ({
  authApi: { uploadAvatar, deleteAvatar },
}))
const forgetAvatar = vi.hoisted(() => vi.fn())
vi.mock('@/lib/avatarImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/avatarImage')>()
  return { ...actual, forgetAvatar, loadAvatarObjectUrl: vi.fn(() => new Promise(() => {})) }
})
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ refreshUser }),
}))

const { ProfilePhotoField } = await import('../ProfilePhotoField')

function file(name: string, type: string, bytes: number) {
  return new File([new Uint8Array(bytes)], name, { type })
}

function corner(label: string) {
  return document.querySelector(`button.absolute[aria-label="${label}"]`)
}

function renderField(avatarUrl: string | null = null) {
  const { container } = render(
    <ProfilePhotoField
      userId={7}
      firstName="Olena"
      lastName="Kovalchuk"
      fullName="Olena Kovalchuk"
      avatarUrl={avatarUrl}
    />
  )
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

describe('ProfilePhotoField', () => {
  beforeEach(() => {
    uploadAvatar.mockReset().mockResolvedValue({})
    deleteAvatar.mockReset().mockResolvedValue({})
    refreshUser.mockReset().mockResolvedValue(undefined)
    toastFns.success.mockReset()
    toastFns.error.mockReset()
  })

  it('shows the monogram when there is no photo', () => {
    renderField(null)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('offers only an upload control when there is no photo', () => {
    renderField(null)

    // Both the avatar and the corner button open the picker while empty, so the
    // name appears twice and neither is a Remove.
    expect(screen.getAllByRole('button', { name: /upload photo/i })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument()
  })

  it('the icon-only control still names itself for assistive tech', () => {
    renderField(null)
    const control = corner('Upload photo')

    expect(control).toHaveAttribute('aria-label', 'Upload photo')
    expect(control).toHaveAttribute('title', 'Upload photo')
    expect(control?.textContent?.trim()).toBe('')
  })

  it('turns the corner control into Remove once a photo exists', () => {
    renderField('/avatars/7.png')

    expect(screen.getByRole('button', { name: /remove photo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upload photo/i })).not.toBeInTheDocument()
  })

  it('keeps a direct replace path once a photo exists', () => {
    renderField('/avatars/7.png')

    // Clicking the photo itself replaces it, so changing a photo never has to
    // go through deleting it first.
    expect(screen.getByRole('button', { name: /replace photo/i })).toBeInTheDocument()
  })

  it('does not show the format hint', () => {
    renderField(null)
    expect(screen.queryByText(/up to 2 MB/i)).not.toBeInTheDocument()
  })

  it('overlays the add control on the avatar rather than beside it', () => {
    const { container } = render(
      <ProfilePhotoField userId={7} firstName="Olena" lastName="Kovalchuk" avatarUrl={null} />
    )
    const control = container.querySelector('button.absolute[aria-label="Upload photo"]')

    expect(control).not.toBeNull()
  })

  it('uploads an accepted image and refreshes the user', async () => {
    const input = renderField(null)

    fireEvent.change(input, { target: { files: [file('me.png', 'image/png', 32)] } })

    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(refreshUser).toHaveBeenCalled())
    expect(toastFns.success).toHaveBeenCalled()
  })

  it('refuses a disallowed type without calling the API', async () => {
    const input = renderField(null)

    fireEvent.change(input, {
      target: { files: [file('virus.exe', 'application/x-msdownload', 32)] },
    })

    await waitFor(() => expect(toastFns.error).toHaveBeenCalled())
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('refuses an oversized image without calling the API', async () => {
    const input = renderField(null)

    fireEvent.change(input, {
      target: { files: [file('huge.png', 'image/png', 3 * 1024 * 1024)] },
    })

    await waitFor(() => expect(toastFns.error).toHaveBeenCalled())
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('removes the photo once the user confirms', async () => {
    renderField('/avatars/7.png')

    fireEvent.click(corner('Remove photo') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: /^remove photo$/i }))

    await waitFor(() => expect(deleteAvatar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(refreshUser).toHaveBeenCalled())
  })

  it('does not remove the photo when the user backs out', async () => {
    renderField('/avatars/7.png')

    fireEvent.click(corner('Remove photo') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))

    await waitFor(() => expect(deleteAvatar).not.toHaveBeenCalled())
    expect(refreshUser).not.toHaveBeenCalled()
  })

  it('reports a failed upload and leaves the photo alone', async () => {
    uploadAvatar.mockRejectedValue(new Error('rejected by the server'))
    const input = renderField('/avatars/7.png')

    fireEvent.change(input, { target: { files: [file('me.png', 'image/png', 32)] } })

    await waitFor(() => expect(toastFns.error).toHaveBeenCalled())
    expect(toastFns.success).not.toHaveBeenCalled()
  })

  it('drops the replaced photo from the cache after an upload', async () => {
    // Otherwise the old bytes keep being served for as long as the tab lives,
    // whenever the replacement arrives under a name that has been seen before.
    const input = renderField('/api/v1/users/avatars/old.png')

    fireEvent.change(input, { target: { files: [file('me.png', 'image/png', 32)] } })

    await waitFor(() => expect(uploadAvatar).toHaveBeenCalled())
    await waitFor(() =>
      expect(forgetAvatar).toHaveBeenCalledWith(
        'https://api.dev.crm-prionex.online/api/v1/users/avatars/old.png'
      )
    )
  })

  it('drops the photo from the cache after a removal', async () => {
    renderField('/api/v1/users/avatars/old.png')

    fireEvent.click(corner('Remove photo') as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: /^remove photo$/i }))

    await waitFor(() => expect(deleteAvatar).toHaveBeenCalled())
    await waitFor(() =>
      expect(forgetAvatar).toHaveBeenCalledWith(
        'https://api.dev.crm-prionex.online/api/v1/users/avatars/old.png'
      )
    )
  })
})
