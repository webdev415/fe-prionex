import { describe, expect, it } from 'vitest'
import { parseLanguages } from '../components/dialogs/parseLanguages'

/**
 * People type the line the design shows, so that is what has to be read back.
 */
describe('parseLanguages', () => {
  it('reads a language and its level', () => {
    expect(parseLanguages('English (B2)')).toEqual([{ language: 'English', level: 'B2' }])
  })

  it('reads several separated by commas', () => {
    expect(parseLanguages('English (B2), Polish (A2)')).toEqual([
      { language: 'English', level: 'B2' },
      { language: 'Polish', level: 'A2' },
    ])
  })

  it('accepts a language with no level', () => {
    expect(parseLanguages('English, Polish (A2)')).toEqual([
      { language: 'English', level: null },
      { language: 'Polish', level: 'A2' },
    ])
  })

  it('ignores the spacing somebody happens to use', () => {
    expect(parseLanguages('  English   (B2)  ,Polish(A2)  ')).toEqual([
      { language: 'English', level: 'B2' },
      { language: 'Polish', level: 'A2' },
    ])
  })

  it('folds a language typed twice rather than letting the table refuse it', () => {
    expect(parseLanguages('English (B2), english (C1)')).toEqual([
      { language: 'English', level: 'B2' },
    ])
  })

  it('drops empty pieces from a trailing comma', () => {
    expect(parseLanguages('English (B2), , ')).toEqual([{ language: 'English', level: 'B2' }])
  })

  it('treats an empty bracket as no level', () => {
    expect(parseLanguages('English ()')).toEqual([{ language: 'English', level: null }])
  })

  it('has nothing to read in an empty line', () => {
    expect(parseLanguages('')).toEqual([])
  })
})
