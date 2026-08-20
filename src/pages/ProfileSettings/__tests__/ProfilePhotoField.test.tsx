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
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ refreshUser }),
}))

const { ProfilePhotoField } = await import('../ProfilePhotoField')

function file(name: string, type: string, bytes: number) {
  return new File([new Uint8Array(bytes)], name, { type })
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

  it('offers an add control when there is no photo, and no Remove', () => {
    renderField(null)
    expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument()
  })

  it('the icon-only control still names itself for assistive tech', () => {
    renderField(null)
    const control = screen.getByRole('button', { name: /upload photo/i })

    expect(control).toHaveAttribute('aria-label', 'Upload photo')
    expect(control).toHaveAttribute('title', 'Upload photo')
    expect(control.textContent?.trim()).toBe('')
  })

  it('offers Replace and Remove once a photo exists', () => {
    renderField('/avatars/7.png')
    expect(screen.getByRole('button', { name: /replace photo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove photo/i })).toBeInTheDocument()
  })

  it('does not show the format hint', () => {
    renderField(null)
    expect(screen.queryByText(/up to 2 MB/i)).not.toBeInTheDocument()
  })

  it('overlays the add control on the avatar rather than beside it', () => {
    const { container } = render(
      <ProfilePhotoField userId={7} firstName="Olena" lastName="Kovalchuk" avatarUrl={null} />
    )
    const control = container.querySelector('button[aria-label="Upload photo"]')

    expect(control?.className).toContain('absolute')
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

  it('removes the photo and refreshes the user', async () => {
    renderField('/avatars/7.png')

    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }))

    await waitFor(() => expect(deleteAvatar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(refreshUser).toHaveBeenCalled())
  })

  it('reports a failed upload and leaves the photo alone', async () => {
    uploadAvatar.mockRejectedValue(new Error('rejected by the server'))
    const input = renderField('/avatars/7.png')

    fireEvent.change(input, { target: { files: [file('me.png', 'image/png', 32)] } })

    await waitFor(() => expect(toastFns.error).toHaveBeenCalled())
    expect(toastFns.success).not.toHaveBeenCalled()
  })
})
