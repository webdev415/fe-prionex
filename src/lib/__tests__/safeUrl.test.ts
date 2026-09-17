import { describe, it, expect } from 'vitest'
import { safeHttpUrl } from '../safeUrl'

describe('safeHttpUrl', () => {
  it('passes an absolute http(s) URL through unchanged', () => {
    expect(safeHttpUrl('https://meet.example.com/abc')).toBe('https://meet.example.com/abc')
    expect(safeHttpUrl('http://meet.example.com/abc')).toBe('http://meet.example.com/abc')
  })

  it('trims surrounding whitespace before judging it', () => {
    expect(safeHttpUrl('  https://meet.example.com/abc  ')).toBe('https://meet.example.com/abc')
  })

  it('drops a javascript: URL', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined()
  })

  it('drops a data: URL', () => {
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined()
  })

  it('drops a scheme-less host, which would otherwise resolve against our origin', () => {
    expect(safeHttpUrl('meet.example.com/abc')).toBeUndefined()
    expect(safeHttpUrl('/dashboard/training')).toBeUndefined()
  })

  it('drops empty, blank and non-string input', () => {
    expect(safeHttpUrl('')).toBeUndefined()
    expect(safeHttpUrl('   ')).toBeUndefined()
    expect(safeHttpUrl(null)).toBeUndefined()
    expect(safeHttpUrl(undefined)).toBeUndefined()
    expect(safeHttpUrl(42)).toBeUndefined()
  })
})
