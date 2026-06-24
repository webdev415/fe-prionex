import { describe, expect, it } from 'vitest'
import {
  blobToBase64,
  extractImageFiles,
  MAX_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  toChatAttachmentPayload,
  validateImageFile,
  type PendingAttachment,
} from '../attachments'

describe('validateImageFile', () => {
  it('accepts png/jpeg/webp within the 5MB limit', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(validateImageFile({ type, size: 1024 }, 0)).toBeNull()
    }
  })

  it('rejects unsupported mime types', () => {
    expect(validateImageFile({ type: 'image/gif', size: 10 }, 0)).toBe('unsupportedType')
    expect(validateImageFile({ type: 'application/pdf', size: 10 }, 0)).toBe('unsupportedType')
  })

  it('rejects images above 5MB', () => {
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }, 0)).toBe('tooLarge')
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES }, 0)).toBeNull()
  })

  it('rejects the 4th attachment', () => {
    expect(validateImageFile({ type: 'image/png', size: 10 }, MAX_ATTACHMENTS)).toBe('tooMany')
    expect(validateImageFile({ type: 'image/png', size: 10 }, MAX_ATTACHMENTS - 1)).toBeNull()
  })
})

describe('blobToBase64', () => {
  it('encodes blob bytes without the data: prefix', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' })
    await expect(blobToBase64(blob)).resolves.toBe(btoa('hello'))
  })
})

describe('extractImageFiles', () => {
  it('picks image files out of clipboard items (duck-typed DataTransferItemList)', () => {
    const image = new File(['x'], 'shot.png', { type: 'image/png' })
    const items = [
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => image },
      { kind: 'file', getAsFile: () => new File(['t'], 'a.txt', { type: 'text/plain' }) },
    ] as unknown as DataTransferItemList
    expect(extractImageFiles(items)).toEqual([image])
  })

  it('filters a plain FileList/array by image mime', () => {
    const image = new File(['x'], 'shot.webp', { type: 'image/webp' })
    const text = new File(['t'], 'a.txt', { type: 'text/plain' })
    expect(extractImageFiles([image, text])).toEqual([image])
  })
})

describe('toChatAttachmentPayload', () => {
  it('strips client-only fields from pending attachments', () => {
    const pending: PendingAttachment[] = [
      {
        id: '1',
        type: 'image',
        mime: 'image/png',
        data_b64: 'aGk=',
        previewUrl: 'blob:x',
        sizeBytes: 2,
      },
      {
        id: '2',
        type: 'audio',
        mime: 'audio/webm',
        data_b64: 'b2s=',
        previewUrl: 'blob:y',
        sizeBytes: 2,
      },
    ]
    expect(toChatAttachmentPayload(pending)).toEqual([
      { type: 'image', mime: 'image/png', data_b64: 'aGk=' },
      { type: 'audio', mime: 'audio/webm', data_b64: 'b2s=' },
    ])
  })
})
