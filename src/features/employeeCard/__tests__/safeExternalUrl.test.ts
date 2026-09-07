import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from '@/features/employeeCard/lib/safeExternalUrl'

describe('a link on an employee record', () => {
  it('keeps an ordinary web address', () => {
    expect(safeExternalUrl('https://forms.gle/abc')).toBe('https://forms.gle/abc')
    expect(safeExternalUrl('http://forms.gle/abc')).toBe('http://forms.gle/abc')
  })

  it('drops a scheme that runs code or hides its origin', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(safeExternalUrl('blob:https://evil.example/x')).toBeUndefined()
  })

  it('drops what is not a link at all', () => {
    expect(safeExternalUrl('')).toBeUndefined()
    expect(safeExternalUrl('   ')).toBeUndefined()
    expect(safeExternalUrl(null)).toBeUndefined()
    expect(safeExternalUrl(42)).toBeUndefined()
  })
})
