import { describe, expect, it } from 'vitest'
import {
  blobToBase64,
  classifyAttachmentMime,
  extractFileEntries,
  formatAttachmentSize,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_FILENAME_LENGTH,
  resolveAttachmentMime,
  toChatAttachmentPayload,
  truncateFilename,
  validateAttachmentFile,
  type PendingAttachment,
} from '../attachments'

describe('validateAttachmentFile', () => {
  it('accepts images', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(validateAttachmentFile({ name: 'shot.png', type, size: 1024 }, 0)).toEqual({
        ok: true,
        type: 'image',
        mime: type,
      })
    }
  })

  it('accepts pdf, excel, csv and docx documents', () => {
    const documents: [string, string][] = [
      ['report.pdf', 'application/pdf'],
      ['book.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['book.xls', 'application/vnd.ms-excel'],
      ['rows.csv', 'text/csv'],
      ['letter.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ]
    for (const [name, type] of documents) {
      expect(validateAttachmentFile({ name, type, size: 2048 }, 0)).toEqual({
        ok: true,
        type: 'document',
        mime: type,
      })
    }
  })

  it('rejects executables and archives', () => {
    expect(
      validateAttachmentFile({ name: 'setup.exe', type: 'application/x-msdownload', size: 10 }, 0)
    ).toEqual({ ok: false, error: 'unsupportedType' })
    expect(
      validateAttachmentFile({ name: 'pack.zip', type: 'application/zip', size: 10 }, 0)
    ).toEqual({ ok: false, error: 'unsupportedType' })
    // A masked mime does not help either — the extension is unknown as well.
    expect(
      validateAttachmentFile({ name: 'setup.exe', type: 'application/octet-stream', size: 10 }, 0)
    ).toEqual({ ok: false, error: 'unsupportedType' })
  })

  it('rejects a file above the size limit, whatever its type', () => {
    expect(
      validateAttachmentFile(
        { name: 'huge.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1 },
        0
      )
    ).toEqual({ ok: false, error: 'tooLarge' })
    expect(
      validateAttachmentFile(
        { name: 'big.png', type: 'image/png', size: MAX_ATTACHMENT_BYTES + 1 },
        0
      )
    ).toEqual({ ok: false, error: 'tooLarge' })
    // Exactly at the cap is still allowed.
    expect(
      validateAttachmentFile(
        { name: 'big.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_BYTES },
        0
      )
    ).toMatchObject({ ok: true })
  })

  it('rejects the attachment past the per-message cap', () => {
    const file = { name: 'a.pdf', type: 'application/pdf', size: 10 }
    expect(validateAttachmentFile(file, MAX_ATTACHMENTS)).toEqual({ ok: false, error: 'tooMany' })
    expect(validateAttachmentFile(file, MAX_ATTACHMENTS - 1)).toMatchObject({ ok: true })
  })
})

describe('resolveAttachmentMime', () => {
  it('keeps the mime the browser reports when it is supported', () => {
    expect(resolveAttachmentMime({ name: 'a.pdf', type: 'application/pdf' })).toBe(
      'application/pdf'
    )
  })

  it('falls back to the extension when the OS reports nothing usable', () => {
    // Windows/Linux hand over a .csv with an empty or generic type.
    expect(resolveAttachmentMime({ name: 'rows.csv', type: '' })).toBe('text/csv')
    expect(resolveAttachmentMime({ name: 'rows.CSV', type: 'application/octet-stream' })).toBe(
      'text/csv'
    )
    expect(resolveAttachmentMime({ name: 'book.xlsx', type: 'text/plain' })).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('returns null for an unsupported file', () => {
    expect(resolveAttachmentMime({ name: 'notes.txt', type: 'text/plain' })).toBeNull()
    expect(resolveAttachmentMime({ name: 'no-extension', type: '' })).toBeNull()
  })
})

describe('classifyAttachmentMime', () => {
  it('splits images from documents', () => {
    expect(classifyAttachmentMime('image/png')).toBe('image')
    expect(classifyAttachmentMime('text/csv')).toBe('document')
    expect(classifyAttachmentMime('audio/webm')).toBeNull()
  })
})

describe('blobToBase64', () => {
  it('encodes blob bytes without the data: prefix', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' })
    await expect(blobToBase64(blob)).resolves.toBe(btoa('hello'))
  })
})

describe('extractFileEntries', () => {
  it('takes every file item and skips string ones (duck-typed DataTransferItemList)', () => {
    const image = new File(['x'], 'shot.png', { type: 'image/png' })
    const pdf = new File(['x'], 'report.pdf', { type: 'application/pdf' })
    // Unsupported files come through too — the toast for them is what tells the
    // operator why a paste did nothing, so filtering here would silence it.
    const text = new File(['t'], 'a.txt', { type: 'text/plain' })
    const items = [
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => image },
      { kind: 'file', getAsFile: () => pdf },
      { kind: 'file', getAsFile: () => text },
    ] as unknown as DataTransferItemList
    expect(extractFileEntries(items)).toEqual([image, pdf, text])
  })

  it('passes a plain FileList/array through', () => {
    const image = new File(['x'], 'shot.webp', { type: 'image/webp' })
    const csv = new File(['a,b'], 'rows.csv', { type: '' })
    expect(extractFileEntries([image, csv])).toEqual([image, csv])
  })
})

describe('formatAttachmentSize', () => {
  it('scales the unit to the size', () => {
    expect(formatAttachmentSize(512)).toBe('512 B')
    expect(formatAttachmentSize(2048)).toBe('2 KB')
    expect(formatAttachmentSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('truncateFilename', () => {
  it('leaves a name that already fits untouched', () => {
    expect(truncateFilename('договір Іванова.pdf')).toBe('договір Іванова.pdf')
    const exact = `${'a'.repeat(MAX_FILENAME_LENGTH - 4)}.pdf`
    expect(truncateFilename(exact)).toBe(exact)
  })

  it('fits an over-long name into the field and keeps the extension', () => {
    const long = `${'a'.repeat(400)}.pdf`
    const fitted = truncateFilename(long)
    expect(Array.from(fitted)).toHaveLength(MAX_FILENAME_LENGTH)
    expect(fitted.endsWith('.pdf')).toBe(true)
    expect(fitted).toContain('…')
  })

  it('keeps both ends of the base name, so the file stays recognisable', () => {
    const fitted = truncateFilename(`contract-${'x'.repeat(400)}-signed.docx`)
    expect(fitted.startsWith('contract-')).toBe(true)
    expect(fitted.endsWith('-signed.docx')).toBe(true)
  })

  it('counts code points, never splitting a surrogate pair', () => {
    // JS length would count each emoji twice and could cut one in half; the
    // backend counts Python characters, so code points are the honest unit.
    const fitted = truncateFilename(`${'😀'.repeat(300)}.pdf`)
    expect(Array.from(fitted)).toHaveLength(MAX_FILENAME_LENGTH)
    expect(fitted).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
    expect(fitted).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
  })

  it('hard-truncates when the extension alone would eat the budget', () => {
    const absurd = `name.${'z'.repeat(400)}`
    expect(Array.from(truncateFilename(absurd))).toHaveLength(MAX_FILENAME_LENGTH)
  })

  it('handles a dotfile without treating the leading dot as an extension', () => {
    const fitted = truncateFilename(`.${'a'.repeat(400)}`)
    expect(Array.from(fitted)).toHaveLength(MAX_FILENAME_LENGTH)
    expect(fitted.startsWith('.')).toBe(true)
  })
})

describe('toChatAttachmentPayload', () => {
  it('strips client-only fields and keeps filename on documents only', () => {
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
      {
        id: '3',
        type: 'document',
        mime: 'application/pdf',
        name: 'report.pdf',
        data_b64: 'cGRm',
        previewUrl: 'blob:z',
        sizeBytes: 3,
      },
    ]
    // The image/audio payload must stay exactly what it was before documents
    // existed — the backend dumps with exclude_none, so an extra key here would
    // be a contract change for the two types that already worked.
    expect(toChatAttachmentPayload(pending)).toEqual([
      { type: 'image', mime: 'image/png', data_b64: 'aGk=' },
      { type: 'audio', mime: 'audio/webm', data_b64: 'b2s=' },
      {
        type: 'document',
        mime: 'application/pdf',
        data_b64: 'cGRm',
        filename: 'report.pdf',
      },
    ])
  })
})
