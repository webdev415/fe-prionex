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

/** Cap on the decoded bytes of one attachment — the same for all three types. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024
/** Attachments per message, all types together. */
export const MAX_ATTACHMENTS = 10
/**
 * How large a *recorded* voice note may get before the recorder drops it. A
 * device-side guard, deliberately not {@link MAX_ATTACHMENT_BYTES}: two minutes
 * of opus is about a megabyte, so anything near this means the recording ran
 * away. Conflating the two is what makes "the limit" ambiguous.
 */
export const MAX_VOICE_MESSAGE_BYTES = 10 * 1024 * 1024
export const MAX_VOICE_MESSAGE_SECONDS = 120
/** Width of the backend's `filename` field (`Field(max_length=255)`). */
export const MAX_FILENAME_LENGTH = 255

export type AttachmentType = 'image' | 'audio' | 'document'

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
  | { ok: false; error: AttachmentValidationError }

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
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'tooLarge' }
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

/**
 * Fit a file name into the backend's 255-character field.
 *
 * The extension is what tells the operator (and the gateway's log) what kind of
 * file this was, so the middle of the base name is what gives way — chopping
 * the tail would turn `contract….pdf` into a nameless blob and cost a 422 for
 * nothing. Counting is by code point, matching Python's `len()`, which also
 * keeps a surrogate pair from being split into an invalid lone half.
 */
export function truncateFilename(name: string, maxLength = MAX_FILENAME_LENGTH): string {
  const chars = Array.from(name)
  if (chars.length <= maxLength) return name

  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? Array.from(name.slice(dot)) : []
  // An extension that eats the whole budget is not an extension worth keeping.
  const budget = maxLength - extension.length
  if (budget <= 1) return chars.slice(0, maxLength).join('')

  const base = chars.slice(0, chars.length - extension.length)
  const keep = budget - 1 // one code point goes to the ellipsis
  const head = base.slice(0, Math.ceil(keep / 2)).join('')
  const tail = keep > 1 ? base.slice(base.length - Math.floor(keep / 2)).join('') : ''
  return `${head}…${tail}${extension.join('')}`
}

export function toChatAttachmentPayload(pending: PendingAttachment[]): ChatAttachmentPayload[] {
  return pending.map(({ type, mime, data_b64, name }) =>
    type === 'document' && name
      ? { type, mime, data_b64, filename: truncateFilename(name) }
      : { type, mime, data_b64 }
  )
}
