/**
 * A material is either a file or a link (KAN-1049).
 *
 * `materialSubtitle` is the one place that decides what the secondary line
 * shows, so the library grid and the call panel cannot drift apart: a file has
 * a size, a link has a host, and a link has no size to format at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isLink, materialSubtitle, openMaterialLink, type Material } from '../materials'

const base: Material = {
  id: 1,
  project_id: 7,
  uploaded_by_user_id: 42,
  title: 'Rebuttals deck',
  description: null,
  kind: 'file',
  url: null,
  mime_type: 'application/pdf',
  size_bytes: 2048,
  original_filename: 'deck.pdf',
  category_id: null,
  tags: null,
  created_at: '2026-09-10T09:00:00Z',
  updated_at: '2026-09-10T09:00:00Z',
  type: 'pdf',
}

const link: Material = {
  ...base,
  kind: 'link',
  url: 'https://slides.example.com/deck?page=2',
  mime_type: null,
  size_bytes: null,
  original_filename: null,
  type: 'link',
}

describe('isLink', () => {
  it('tells the two kinds apart', () => {
    expect(isLink(link)).toBe(true)
    expect(isLink(base)).toBe(false)
  })
})

describe('materialSubtitle', () => {
  it('shows a file size for a file', () => {
    expect(materialSubtitle(base)).toBe('2 KB')
  })

  it('shows the host for a link, not a size', () => {
    expect(materialSubtitle(link)).toBe('slides.example.com')
  })

  it('does not crash on a link whose url is unparseable', () => {
    expect(materialSubtitle({ ...link, url: 'not a url' })).toBe('')
    expect(materialSubtitle({ ...link, url: null })).toBe('')
  })

  it('treats a file with no recorded size as zero rather than NaN', () => {
    expect(materialSubtitle({ ...base, size_bytes: null })).toBe('0 B')
  })
})

describe('openMaterialLink', () => {
  const opened: string[] = []
  const fakeSafe = (raw: unknown) =>
    typeof raw === 'string' && raw.startsWith('https://') ? raw : undefined

  beforeEach(() => {
    opened.length = 0
    vi.stubGlobal('open', (url: string) => {
      opened.push(url)
      return null
    })
  })

  it('opens a valid link and reports success', () => {
    expect(openMaterialLink(link, fakeSafe)).toBe(true)
    expect(opened).toEqual(['https://slides.example.com/deck?page=2'])
  })

  it('reports failure instead of opening, when the stored url is rejected', () => {
    // A legacy row, or a value that reached the column by some path other than
    // the validated endpoint. The caller has to say something — a live-looking
    // button that does nothing is worse than an error.
    expect(openMaterialLink({ url: 'javascript:alert(1)' }, fakeSafe)).toBe(false)
    expect(openMaterialLink({ url: 'slides.example.com' }, fakeSafe)).toBe(false)
    expect(openMaterialLink({ url: null }, fakeSafe)).toBe(false)
    expect(opened).toEqual([])
  })
})
