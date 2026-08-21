import { describe, expect, it } from 'vitest'
import {
  buildContextBlock,
  buildContextualMessage,
  contextChipLabel,
  CONTEXT_BLOCK_MAX_CHARS,
  isDockEmbedSearch,
  normalizeOnexAsk,
  normalizeOnexPageContext,
  shouldStripDashboardChrome,
} from '../embedContext'

describe('isDockEmbedSearch', () => {
  it('recognises the OneX dock query', () => {
    expect(isDockEmbedSearch('?embed=dock')).toBe(true)
    expect(isDockEmbedSearch('embed=dock')).toBe(true)
    expect(isDockEmbedSearch('?foo=1&embed=dock')).toBe(true)
  })

  it('ignores every other search string', () => {
    expect(isDockEmbedSearch('')).toBe(false)
    expect(isDockEmbedSearch(undefined)).toBe(false)
    expect(isDockEmbedSearch(null)).toBe(false)
    expect(isDockEmbedSearch('?embed=1')).toBe(false)
    expect(isDockEmbedSearch('?embed=DOCK')).toBe(false)
    expect(isDockEmbedSearch('?embedded=dock')).toBe(false)
  })
})

describe('shouldStripDashboardChrome', () => {
  it('strips the chrome only on the assistant route', () => {
    expect(shouldStripDashboardChrome('/dashboard/ai-assistant', '?embed=dock')).toBe(true)
    expect(shouldStripDashboardChrome('/dashboard/ai-assistant/', '?embed=dock')).toBe(true)
  })

  it('leaves every other route alone even with the dock query', () => {
    // A stray ?embed=dock must never blank the rail on an unrelated page.
    expect(shouldStripDashboardChrome('/dashboard', '?embed=dock')).toBe(false)
    expect(shouldStripDashboardChrome('/dashboard/clients', '?embed=dock')).toBe(false)
    expect(shouldStripDashboardChrome('/dashboard/ai-assistant', '')).toBe(false)
  })
})

describe('normalizeOnexPageContext', () => {
  it('reads the documented detail shape', () => {
    expect(
      normalizeOnexPageContext({
        url: 'https://crm-prionex.online/dashboard/clients/42',
        title: 'Клієнт Іваненко',
        clientId: 42,
        selection: 'борг 12 000',
        text: 'сторінка клієнта',
        ts: 1755800000000,
      })
    ).toEqual({
      url: 'https://crm-prionex.online/dashboard/clients/42',
      title: 'Клієнт Іваненко',
      clientId: 42,
      selection: 'борг 12 000',
      text: 'сторінка клієнта',
      ts: 1755800000000,
    })
  })

  it('accepts a numeric string clientId and rejects a non-positive one', () => {
    expect(normalizeOnexPageContext({ clientId: '42' })?.clientId).toBe(42)
    expect(normalizeOnexPageContext({ title: 'x', clientId: '0' })?.clientId).toBeNull()
    expect(normalizeOnexPageContext({ title: 'x', clientId: 'abc' })?.clientId).toBeNull()
    expect(normalizeOnexPageContext({ title: 'x', clientId: 4.5 })?.clientId).toBeNull()
  })

  it('collapses whitespace and clips oversized fields', () => {
    const context = normalizeOnexPageContext({
      title: '  Клієнт \n\n Іваненко  ',
      text: 'а'.repeat(5000),
    })
    expect(context?.title).toBe('Клієнт Іваненко')
    expect(context?.text?.length).toBeLessThanOrEqual(1200)
    expect(context?.text?.endsWith('…')).toBe(true)
  })

  it('returns null when the payload carries nothing usable', () => {
    expect(normalizeOnexPageContext(null)).toBeNull()
    expect(normalizeOnexPageContext('nope')).toBeNull()
    expect(normalizeOnexPageContext({})).toBeNull()
    expect(normalizeOnexPageContext({ ts: 1 })).toBeNull()
    expect(normalizeOnexPageContext({ title: '   ' })).toBeNull()
  })
})

describe('contextChipLabel', () => {
  it('prefers the title, then the url, else null', () => {
    const base = { url: null, title: null, clientId: null, selection: null, text: null, ts: null }
    expect(contextChipLabel({ ...base, title: 'Картка клієнта', url: 'u' })).toBe('Картка клієнта')
    expect(contextChipLabel({ ...base, url: 'https://crm/x' })).toBe('https://crm/x')
    expect(contextChipLabel({ ...base, clientId: 7 })).toBeNull()
  })
})

describe('buildContextBlock', () => {
  it('renders one labelled line per known field', () => {
    const block = buildContextBlock({
      url: 'https://crm/x',
      title: 'Картка клієнта',
      clientId: 42,
      selection: 'борг 12 000',
      text: 'тіло сторінки',
      ts: 1,
    })
    expect(block).toBe(
      [
        'Контекст сторінки: Картка клієнта — https://crm/x',
        'Клієнт ID: 42',
        'Виділений текст: борг 12 000',
        'Текст сторінки: тіло сторінки',
      ].join('\n')
    )
  })

  it('omits missing fields and returns null with nothing to say', () => {
    const base = { url: null, title: null, clientId: null, selection: null, text: null, ts: null }
    expect(buildContextBlock({ ...base, clientId: 7 })).toBe('Клієнт ID: 7')
    expect(buildContextBlock(base)).toBeNull()
    expect(buildContextBlock(null)).toBeNull()
  })

  it('caps the whole block so a huge page cannot flood the prompt', () => {
    const block = buildContextBlock({
      url: `https://crm/${'u'.repeat(600)}`,
      title: 'т'.repeat(300),
      clientId: 42,
      selection: 'с'.repeat(2000),
      text: 'x'.repeat(5000),
      ts: null,
    })
    expect(block).not.toBeNull()
    expect(block!.length).toBeLessThanOrEqual(CONTEXT_BLOCK_MAX_CHARS)
  })
})

describe('buildContextualMessage', () => {
  it('prepends the context block to the operator prompt', () => {
    const message = buildContextualMessage('Що робити?', {
      url: null,
      title: 'Картка клієнта',
      clientId: 42,
      selection: null,
      text: null,
      ts: null,
    })
    expect(message).toBe('Контекст сторінки: Картка клієнта\nКлієнт ID: 42\n\nЩо робити?')
  })

  it('returns the prompt untouched without context', () => {
    expect(buildContextualMessage('Що робити?', null)).toBe('Що робити?')
  })

  it('leaves an empty prompt empty (voice-note turns stay audio-only)', () => {
    // The chat contract allows an empty `message` only for an audio turn — a
    // context preamble must not silently turn it into a text turn.
    expect(
      buildContextualMessage('', {
        url: null,
        title: 'Картка клієнта',
        clientId: 42,
        selection: null,
        text: null,
        ts: null,
      })
    ).toBe('')
  })
})

describe('normalizeOnexAsk', () => {
  it('reads text and the summary preset', () => {
    expect(normalizeOnexAsk({ text: '  Підсумуй  ' })).toEqual({ text: 'Підсумуй', preset: null })
    expect(normalizeOnexAsk({ text: '', preset: 'summary' })).toEqual({
      text: '',
      preset: 'summary',
    })
    expect(normalizeOnexAsk({ text: 'своє', preset: 'summary' })).toEqual({
      text: 'своє',
      preset: 'summary',
    })
  })

  it('rejects payloads with neither text nor a known preset', () => {
    expect(normalizeOnexAsk(null)).toBeNull()
    expect(normalizeOnexAsk({})).toBeNull()
    expect(normalizeOnexAsk({ text: '   ' })).toBeNull()
    expect(normalizeOnexAsk({ preset: 'unknown' })).toBeNull()
  })
})
