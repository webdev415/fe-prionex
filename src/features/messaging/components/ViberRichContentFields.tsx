import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { messagingApi } from '../api/messagingApi'
import {
  MAX_VIBER_IMAGES,
  shouldDeleteViberImageOnServer,
  type MessagingViberImageAttachment,
  revokeViberImagePreviews,
} from '../utils/viberContent'
import { piiProps } from '@/lib/openreplay/pii'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function uploadErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string }; detail?: string }
      | undefined
    if (data?.error?.message) return data.error.message
    if (typeof data?.detail === 'string') return data.detail
    if (error.response?.status === 404) {
      return 'Upload endpoint not found — rebuild and restart messaging-service'
    }
  }
  return fallback
}

function newAttachmentId(): string {
  return `viber-img-${crypto.randomUUID()}`
}

interface ViberRichContentFieldsProps {
  addImage: boolean
  onAddImageChange: (value: boolean) => void
  images: MessagingViberImageAttachment[]
  onImagesChange: Dispatch<SetStateAction<MessagingViberImageAttachment[]>>
  addButton: boolean
  onAddButtonChange: (value: boolean) => void
  buttonName: string
  onButtonNameChange: (value: string) => void
  buttonUrl: string
  onButtonUrlChange: (value: string) => void
  disabled?: boolean
  className?: string
  /**
   * `compose` — send/bulk modals: only delete server files for session uploads.
   * `template-editor` — draft page: delete server file when removing any image.
   */
  imageRemovalMode?: 'compose' | 'template-editor'
}

export function ViberRichContentFields({
  addImage,
  onAddImageChange,
  images,
  onImagesChange,
  addButton,
  onAddButtonChange,
  buttonName,
  onButtonNameChange,
  buttonUrl,
  onButtonUrlChange,
  disabled = false,
  className,
  imageRemovalMode = 'compose',
}: ViberRichContentFieldsProps) {
  const { t } = useTranslation('common')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef(images)
  const [dragActive, setDragActive] = useState(false)

  const p = 'pages.messagingCampaigns.viber'
  const isUploading = images.some((image) => image.uploading)

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(
    () => () => {
      revokeViberImagePreviews(imagesRef.current)
    },
    []
  )

  const deleteServerFilesForAttachments = useCallback(
    async (attachments: MessagingViberImageAttachment[]) => {
      for (const attachment of attachments) {
        if (!shouldDeleteViberImageOnServer(attachment, imageRemovalMode)) continue
        if (!attachment.storedName) continue
        try {
          await messagingApi.deleteViberImage(attachment.storedName)
        } catch (error) {
          console.error('viber image delete failed', error)
        }
      }
    },
    [imageRemovalMode]
  )

  const clearImageSelection = useCallback(() => {
    const current = imagesRef.current
    void deleteServerFilesForAttachments(current)
    revokeViberImagePreviews(current)
    onImagesChange([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [deleteServerFilesForAttachments, onImagesChange])

  const handleAddImageChange = (checked: boolean) => {
    onAddImageChange(checked)
    if (!checked) clearImageSelection()
  }

  const validateImageFile = (file: File): string | null => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return t(`${p}.imageTypeError`, 'Only JPEG, PNG, GIF, or WebP images are accepted.')
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return t(`${p}.imageSizeError`, {
        defaultValue: 'Image is too large (max {{max}} MB).',
        max: 5,
      })
    }
    return null
  }

  const removeImage = async (attachment: MessagingViberImageAttachment) => {
    const deleteOnServer = shouldDeleteViberImageOnServer(attachment, imageRemovalMode)
    const confirmMessage = deleteOnServer
      ? t('common.confirmDelete', 'Are you sure you want to delete this item?')
      : t(
          `${p}.confirmRemoveDraftImage`,
          'Remove this image from the message? The draft template will keep its image.'
        )
    if (!window.confirm(confirmMessage)) {
      return
    }
    if (deleteOnServer && attachment.storedName) {
      try {
        await messagingApi.deleteViberImage(attachment.storedName)
      } catch (error) {
        console.error('viber image delete failed', error)
        toast.error(
          uploadErrorMessage(error, t(`${p}.imageDeleteFailed`, 'Could not delete image'))
        )
        return
      }
    }
    if (attachment.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.previewUrl)
    }
    onImagesChange((current) => current.filter((item) => item.id !== attachment.id))
    toast.success(
      deleteOnServer
        ? t(`${p}.imageDeleted`, 'Image removed')
        : t(`${p}.imageDetached`, 'Image removed from this message')
    )
  }

  const uploadFiles = async (files: File[]) => {
    const readyCount = imagesRef.current.filter((item) => !item.uploading).length
    const slotsLeft = MAX_VIBER_IMAGES - readyCount
    if (slotsLeft <= 0) {
      toast.error(
        t(`${p}.imageMaxCount`, {
          defaultValue: 'You can attach up to {{max}} images.',
          max: MAX_VIBER_IMAGES,
        })
      )
      return
    }
    const batch = files.slice(0, slotsLeft)
    if (files.length > batch.length) {
      toast.warning(
        t(`${p}.imageMaxCount`, {
          defaultValue: 'You can attach up to {{max}} images.',
          max: MAX_VIBER_IMAGES,
        })
      )
    }

    for (const file of batch) {
      const error = validateImageFile(file)
      if (error) {
        toast.error(error)
        continue
      }

      const id = newAttachmentId()
      const previewUrl = URL.createObjectURL(file)
      const pending: MessagingViberImageAttachment = {
        id,
        previewUrl,
        publicUrl: '',
        storedName: null,
        fileName: file.name,
        source: 'upload',
        uploading: true,
      }
      onImagesChange((current) => [...current, pending])

      try {
        const { url, stored_name } = await messagingApi.uploadViberImage(file)
        onImagesChange((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  publicUrl: url,
                  storedName: stored_name,
                  source: 'upload' as const,
                  uploading: false,
                }
              : item
          )
        )
      } catch (uploadError) {
        console.error('viber image upload failed', uploadError)
        toast.error(
          uploadErrorMessage(uploadError, t(`${p}.imageUploadFailed`, 'Could not upload image'))
        )
        URL.revokeObjectURL(previewUrl)
        onImagesChange((current) => current.filter((item) => item.id !== id))
      }
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || isUploading) return
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (disabled || isUploading) return
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) void uploadFiles(files)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) void uploadFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const displayImages = images.filter((item) => item.previewUrl)

  return (
    <div
      className={cn(
        'border-border bg-muted/80 flex flex-col gap-3 rounded-lg border p-3',
        className
      )}
    >
      <p className="text-foreground text-xs font-medium">
        {t(`${p}.richContentTitle`, 'Viber rich content (My2)')}
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={addImage}
          disabled={disabled || isUploading}
          onChange={(e) => handleAddImageChange(e.target.checked)}
          className="accent-primary-500"
        />
        {t(`${p}.addImage`, 'Add image')}
      </label>

      {addImage && (
        <div className="flex flex-col gap-3">
          {displayImages.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {displayImages.map((attachment) => (
                <li
                  key={attachment.id}
                  className="border-border bg-card relative overflow-hidden rounded-lg border"
                >
                  <img
                    src={attachment.previewUrl}
                    // The role, not the file name: `alt` is sent to the recording
                    // verbatim (KAN-KB-54), and the image itself is replaced by a
                    // placeholder under the attribute.
                    alt={t('pages.messaging.attachmentPreview', 'Attachment preview')}
                    className="aspect-square w-full object-cover"
                    {...piiProps}
                  />
                  {attachment.uploading && (
                    <div className="bg-dark-500/40 absolute inset-0 flex items-center justify-center">
                      <Icons.Spinner className="h-8 w-8 text-white" />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={disabled || attachment.uploading}
                    onClick={() => void removeImage(attachment)}
                    className="bg-dark-500/70 hover:bg-dark-500 absolute top-1 right-1 rounded-full p-1 text-white disabled:opacity-50"
                    aria-label={t(`${p}.removeImage`, 'Remove image')}
                  >
                    <Icons.Cancel01 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {displayImages.length < MAX_VIBER_IMAGES && (
            <div
              role="button"
              tabIndex={disabled || isUploading ? -1 : 0}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (disabled || isUploading) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              className={cn(
                'focus:ring-primary-500 focus:ring-offset-card relative flex min-h-[8rem] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none',
                dragActive
                  ? 'border-primary-500 bg-muted'
                  : 'border-border bg-card hover:bg-muted/50',
                (disabled || isUploading) && 'pointer-events-none opacity-50'
              )}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2 p-3">
                  <Icons.Spinner className="h-8 w-8" />
                  <p className="text-muted-foreground text-sm">
                    {t(`${p}.imageUploading`, 'Uploading image…')}
                  </p>
                </div>
              ) : (
                <>
                  <Icons.FileImport size={28} className="text-muted-foreground" />
                  <p className="text-foreground mt-2 text-center text-sm">
                    <span className="text-primary-600 font-medium">
                      {t(`${p}.imageUploadClick`, 'Click to upload')}
                    </span>{' '}
                    {t(`${p}.imageUploadOrDrop`, 'or drag and drop')}
                  </p>
                  <p className="text-muted-foreground mt-1 text-center text-xs">
                    {t(`${p}.imageUploadConstraints`, 'JPEG, PNG, GIF, WebP — max 5 MB each')}
                  </p>
                  <p className="text-muted-foreground mt-1 text-center text-xs">
                    {t(`${p}.imageMultiHint`, 'One image per Viber message.')}
                  </p>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={handleFileInputChange}
                className="hidden"
                disabled={disabled || isUploading}
              />
            </div>
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={addButton}
          disabled={disabled}
          onChange={(e) => {
            const checked = e.target.checked
            onAddButtonChange(checked)
            if (!checked) {
              onButtonNameChange('')
              onButtonUrlChange('')
            }
          }}
          className="accent-primary-500"
        />
        {t(`${p}.addButton`, 'Add button')}
      </label>
      {addButton && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={buttonName}
            onChange={(e) => onButtonNameChange(e.target.value)}
            disabled={disabled}
            placeholder={t(`${p}.buttonLabelPlaceholder`, 'Pay now')}
            label={t(`${p}.buttonLabel`, 'Button label')}
          />
          <Input
            type="url"
            value={buttonUrl}
            onChange={(e) => onButtonUrlChange(e.target.value)}
            disabled={disabled}
            placeholder={t(`${p}.buttonUrlPlaceholder`, 'https://example.com/pay')}
            label={t(`${p}.buttonUrl`, 'Button URL')}
          />
        </div>
      )}
    </div>
  )
}
