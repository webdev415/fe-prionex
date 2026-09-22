/**
 * The card puts the given name first.
 *
 * Everywhere else in the app the name reads surname first - the employees
 * list, the pickers, the avatar's monogram. The card is the exception, so it
 * composes its own rather than changing what ``full_name`` means for
 * everything that shares it.
 */

import { describe, expect, it } from 'vitest'
import { displayName } from '../lib/displayName'

const header = (over: Record<string, string | null> = {}) => ({
  first_name: 'James',
  last_name: 'Chang',
  full_name: 'Chang James',
  ...over,
})

describe('displayName', () => {
  it('reads given name then surname', () => {
    expect(displayName(header())).toBe('James Chang')
  })

  it('is not what the server sent', () => {
    expect(displayName(header())).not.toBe(header().full_name)
  })

  it('drops the gap when a part is missing rather than leaving a space', () => {
    expect(displayName(header({ last_name: '' }))).toBe('James')
    expect(displayName(header({ first_name: '' }))).toBe('Chang')
  })

  /*
   * An older response has neither part - the fields were added to the header
   * after the card shipped - and a name is the one thing on the panel that
   * cannot render as an empty line.
   */
  it('falls back to what the server sent when it has neither part', () => {
    expect(displayName({ first_name: '', last_name: '', full_name: 'Chang James' })).toBe(
      'Chang James'
    )
  })
})
