import { describe, expect, it } from 'vitest'
import { getFilenameExtensionLabel } from '../attachmentExtension'

describe('getFilenameExtensionLabel', () => {
  it('returns uppercase extension from filename', () => {
    expect(getFilenameExtensionLabel('report.pdf')).toBe('PDF')
    expect(getFilenameExtensionLabel('123.py')).toBe('PY')
    expect(getFilenameExtensionLabel('photo_2026_y.jpg')).toBe('JPG')
    expect(getFilenameExtensionLabel('assesment.rar')).toBe('RAR')
    expect(getFilenameExtensionLabel('letter.docx')).toBe('DOCX')
    expect(getFilenameExtensionLabel('image.PNG')).toBe('PNG')
  })

  it('falls back when extension is missing', () => {
    expect(getFilenameExtensionLabel('README')).toBe('FILE')
    expect(getFilenameExtensionLabel('.gitignore')).toBe('FILE')
    expect(getFilenameExtensionLabel('file.')).toBe('FILE')
  })
})
