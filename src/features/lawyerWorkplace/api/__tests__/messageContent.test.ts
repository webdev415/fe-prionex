import { describe, expect, it } from 'vitest'
import { mapMessageContent } from '../mappers'

describe('mapMessageContent', () => {
  it('prefers body_html for HTML rendering', () => {
    expect(
      mapMessageContent({
        body_text: 'Plain fallback',
        body_html: '<p>Hello <strong>world</strong></p>',
      })
    ).toEqual({
      body: '<p>Hello <strong>world</strong></p>',
      bodyFormat: 'html',
    })
  })

  it('uses plain text when only body_text is present', () => {
    expect(
      mapMessageContent({
        body_text: 'Please review my complaint.',
        body_html: null,
      })
    ).toEqual({
      body: 'Please review my complaint.',
      bodyFormat: 'text',
    })
  })

  it('renders HTML-looking body_text as html when body_html is missing', () => {
    const html = '<div style="background:#f5f5f5;">Newsletter</div>'
    expect(
      mapMessageContent({
        body_text: html,
        body_html: null,
      })
    ).toEqual({
      body: html,
      bodyFormat: 'html',
    })
  })

  it('returns empty text body when both parts are missing', () => {
    expect(
      mapMessageContent({
        body_text: null,
        body_html: null,
      })
    ).toEqual({
      body: '',
      bodyFormat: 'text',
    })
  })
})
