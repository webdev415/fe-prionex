/**
 * Attachment helpers for the AI assistant chat (mirror of the backend
 * contract in services/ai-assistant schemas/chat.py, PR #633 / #638):
 * images — png/jpeg/webp up to 5MB, audio — webm/ogg/wav/mpeg up to 10MB,
 * at most 3 attachments per message.
 */

export const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS = 3
export const MAX_VOICE_MESSAGE_SECONDS = 120

export type AttachmentType = 'image' | 'audio'

/** Wire format of one attachment in POST /chat. */
export interface ChatAttachmentPayload {
  type: AttachmentType
  mime: string
  data_b64: string
}

/** Attachment staged in the composer before sending (preview chip). */
export interface PendingAttachment {
  id: string
  type: AttachmentType
  mime: string
  data_b64: string
  /** Object URL for the thumbnail / audio player; revoke after the message leaves the feed. */
  previewUrl: string
  sizeBytes: number
}

export type ImageValidationError = 'unsupportedType' | 'tooLarge' | 'tooMany'

export function validateImageFile(
  file: { type: string; size: number },
  currentCount: number
): ImageValidationError | null {
  if (!(ALLOWED_IMAGE_MIMES as readonly string[]).includes(file.type)) return 'unsupportedType'
  if (file.size > MAX_IMAGE_BYTES) return 'tooLarge'
  if (currentCount >= MAX_ATTACHMENTS) return 'tooMany'
  return null
}

/** Encode a Blob into base64 (no data: prefix) via FileReader. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Extract image files from a paste/drop source, in original order.
 * Duck-typed (no `instanceof DataTransferItemList`) — jsdom in tests has no
 * DataTransferItemList constructor.
 */
export function extractImageFiles(items: DataTransferItemList | FileList | File[]): File[] {
  const files: File[] = []
  for (const entry of Array.from(items as ArrayLike<DataTransferItem | File>)) {
    if (typeof (entry as DataTransferItem).getAsFile === 'function') {
      const item = entry as DataTransferItem
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file && file.type.startsWith('image/')) files.push(file)
      continue
    }
    const file = entry as File
    if (file && typeof file.type === 'string' && file.type.startsWith('image/')) {
      files.push(file)
    }
  }
  return files
}

export function toChatAttachmentPayload(pending: PendingAttachment[]): ChatAttachmentPayload[] {
  return pending.map(({ type, mime, data_b64 }) => ({ type, mime, data_b64 }))
}
