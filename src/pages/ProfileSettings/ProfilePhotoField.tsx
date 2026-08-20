/**
 * Upload, replace or remove the signed-in user's profile photo.
 *
 * The photo itself is the upload target, so replacing one is a single click and
 * never goes through an empty state. The corner button is the destructive one
 * and asks first: the previous file is deleted on the server, so a mis-click on
 * the spot where "+" used to be would otherwise be unrecoverable.
 *
 * The size and type checks here are a courtesy so the user gets an immediate
 * answer instead of a round trip. They are not the guard: the file name, the
 * extension and the type the browser reports all travel with the request and
 * none can be trusted, so the server decides on the file's own bytes and this
 * only mirrors its limits.
 */

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useConfirm } from '@/components/ui/useConfirm'
import { getErrorMessage } from '@/lib/errors'
import { authApi } from '@/features/auth/api/authApi'
import { useAuthStore } from '@/stores/authStore'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

export interface ProfilePhotoFieldProps {
  userId: number | null | undefined
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  avatarUrl?: string | null
}

export function ProfilePhotoField({
  userId,
  firstName,
  lastName,
  fullName,
  avatarUrl,
}: ProfilePhotoFieldProps) {
  const { t } = useTranslation('common')
  const { confirm, confirmDialog } = useConfirm()
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isBusy, setIsBusy] = useState(false)

  const actionLabel = avatarUrl
    ? t('pages.profileSettings.photo.remove', 'Remove photo')
    : t('pages.profileSettings.photo.upload', 'Upload photo')

  const pickerLabel = avatarUrl
    ? t('pages.profileSettings.photo.replace', 'Replace photo')
    : t('pages.profileSettings.photo.upload', 'Upload photo')

  const handleFile = async (file: File | undefined) => {
    if (!file) return

    if (!ACCEPTED.includes(file.type)) {
      toast.error(t('pages.profileSettings.photo.wrongType', 'Choose a JPEG, PNG or WebP image'))
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('pages.profileSettings.photo.tooLarge', 'The photo must be 2 MB or smaller'))
      return
    }

    try {
      setIsBusy(true)
      await authApi.uploadAvatar(file)
      await refreshUser()
      toast.success(t('pages.profileSettings.photo.uploaded', 'Photo updated'))
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    const confirmed = await confirm({
      title: t('pages.profileSettings.photo.confirmRemoveTitle', 'Remove your photo?'),
      message: t(
        'pages.profileSettings.photo.confirmRemoveMessage',
        'Your initials will be shown instead. You can upload a new photo at any time.'
      ),
      confirmLabel: t('pages.profileSettings.photo.remove', 'Remove photo'),
      cancelLabel: t('actions.cancel'),
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      setIsBusy(true)
      await authApi.deleteAvatar()
      await refreshUser()
      toast.success(t('pages.profileSettings.photo.removed', 'Photo removed'))
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {confirmDialog}
      <div className="relative">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          title={pickerLabel}
          aria-label={pickerLabel}
          className="rounded-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UserAvatar
            userId={userId}
            firstName={firstName}
            lastName={lastName}
            fullName={fullName}
            avatarUrl={avatarUrl}
            size={96}
            className="border-border border-2"
          />
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => (avatarUrl ? void handleRemove() : inputRef.current?.click())}
          title={actionLabel}
          aria-label={actionLabel}
          className="bg-primary text-primary-foreground border-card absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {avatarUrl ? (
            <Icons.Delete size={16} strokeWidth={2} />
          ) : (
            <Icons.Add size={16} strokeWidth={2} />
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  )
}
