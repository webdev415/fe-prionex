/**
 * Attachment helpers for the AI assistant chat (mirror of the backend
 * contract in services/ai-assistant schemas/chat.py):
 * images — png/jpeg/webp, documents — pdf/xlsx/xls/csv/docx, audio — voice
 * notes (webm/ogg/wav/mpeg). The gateway parses documents server-side (text of
 * a PDF, sheets of a workbook); the client only uploads the bytes.
 *
 * The constants below are the single place the client writes the limits down —
 * keep them in sync with the backend schema when it moves. The backend also
 * sniffs the container signature (a .exe renamed to .pdf is rejected there),
 * which the client cannot mirror — such a file fails with the server's own 422.
 */

export const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Documents the gateway can read. Excel covers both the OOXML and the legacy mime. */
export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Also the recorder-side cap for a voice note. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
/** Attachments per message, all types together. */
export const MAX_ATTACHMENTS = 3
export const MAX_VOICE_MESSAGE_SECONDS = 120

export type AttachmentType = 'image' | 'audio' | 'document'

/** Cap on the decoded bytes, per type — mirrors the backend, which differs by type. */
export const MAX_ATTACHMENT_BYTES: Record<AttachmentType, number> = {
  image: MAX_IMAGE_BYTES,
  audio: MAX_AUDIO_BYTES,
  document: MAX_DOCUMENT_BYTES,
}

/** Wire format of one attachment in POST /chat. */
export interface ChatAttachmentPayload {
  type: AttachmentType
  mime: string
  data_b64: string
  /**
   * Documents only — the gateway shows it to the operator and logs it. Images
   * and voice notes omit the key entirely (the backend dumps with
   * `exclude_none`, so their payload stays byte-for-byte what it was).
   */
  filename?: string
}

/** Attachment staged in the composer before sending (preview chip / card). */
export interface PendingAttachment {
  id: string
  type: AttachmentType
  mime: string
  data_b64: string
  /** Original file name; voice notes have none. */
  name?: string
  /** Object URL for the thumbnail / audio player; revoke after the message leaves the feed. */
  previewUrl: string
  sizeBytes: number
}

export type AttachmentValidationError = 'unsupportedType' | 'tooLarge' | 'tooMany'

export type AttachmentVerdict =
  | { ok: true; type: AttachmentType; mime: string }
  | { ok: false; error: 'unsupportedType' | 'tooMany' }
  /** `limit` is the cap for *this* file's type — the message must name the right one. */
  | { ok: false; error: 'tooLarge'; limit: number }

/**
 * Extension → mime, used when the OS reports nothing usable. Windows without
 * Excel installed hands over a .csv as `application/octet-stream` or with an
 * empty type, and Linux file managers often report `text/plain` — going by the
 * name is what keeps a legitimate CSV from being rejected as "unsupported".
 */
const EXTENSION_MIMES: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/** `accept` for the file picker: mimes plus extensions (the mime alone misses .csv). */
export const ATTACHMENT_ACCEPT = [
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_DOCUMENT_MIMES,
  '.pdf',
  '.xlsx',
  '.xls',
  '.csv',
  '.docx',
].join(',')

function isAllowedMime(mime: string): boolean {
  return (
    (ALLOWED_IMAGE_MIMES as readonly string[]).includes(mime) ||
    (ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(mime)
  )
}

/**
 * The mime to send for a picked file: the browser's type when it is one we
 * accept, otherwise the one implied by the extension. Returns null when
 * neither identifies a supported attachment.
 */
export function resolveAttachmentMime(file: { name?: string; type?: string }): string | null {
  const reported = (file.type ?? '').toLowerCase()
  if (isAllowedMime(reported)) return reported
  const extension = (file.name ?? '').toLowerCase().split('.').pop() ?? ''
  return EXTENSION_MIMES[extension] ?? null
}

export function classifyAttachmentMime(mime: string): AttachmentType | null {
  if ((ALLOWED_IMAGE_MIMES as readonly string[]).includes(mime)) return 'image'
  if ((ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(mime)) return 'document'
  return null
}

/**
 * Validate one picked file against the contract. `currentCount` is how many
 * attachments the message already carries (staged ones included).
 */
export function validateAttachmentFile(
  file: { name?: string; type?: string; size: number },
  currentCount: number
): AttachmentVerdict {
  const mime = resolveAttachmentMime(file)
  const type = mime ? classifyAttachmentMime(mime) : null
  if (!mime || !type) return { ok: false, error: 'unsupportedType' }
  const limit = MAX_ATTACHMENT_BYTES[type]
  if (file.size > limit) return { ok: false, error: 'tooLarge', limit }
  if (currentCount >= MAX_ATTACHMENTS) return { ok: false, error: 'tooMany' }
  return { ok: true, type, mime }
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
 * Every file carried by a paste/drop source, in original order — the type is
 * *not* filtered here on purpose: {@link validateAttachmentFile} is the single
 * place that decides what is supported, so an unsupported paste can say why
 * instead of doing nothing. String clipboard items (a plain text paste) are
 * skipped, which is what keeps normal typing untouched.
 *
 * Duck-typed (no `instanceof DataTransferItemList`) — jsdom in tests has no
 * DataTransferItemList constructor.
 */
export function extractFileEntries(items: DataTransferItemList | FileList | File[]): File[] {
  const files: File[] = []
  for (const entry of Array.from(items as ArrayLike<DataTransferItem | File>)) {
    if (typeof (entry as DataTransferItem).getAsFile === 'function') {
      const item = entry as DataTransferItem
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file) files.push(file)
      continue
    }
    const file = entry as File
    if (file && typeof file.name === 'string') files.push(file)
  }
  return files
}

/** Human-readable size for an attachment card. */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function toChatAttachmentPayload(pending: PendingAttachment[]): ChatAttachmentPayload[] {
  return pending.map(({ type, mime, data_b64, name }) =>
    type === 'document' && name
      ? { type, mime, data_b64, filename: name }
      : { type, mime, data_b64 }
  )
}
