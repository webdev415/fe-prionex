/**
 * KAN-973 — key-combination rules.
 *
 * The cases that matter and why:
 *
 * * a bare modifier press must not resolve, or a binding fires the instant the
 *   operator touches Ctrl, before they have chosen a key;
 * * typing must never trigger, which is what makes bare-key bindings usable at
 *   all — with `a` assigned, every letter typed into a search box would
 *   otherwise launch a modal;
 * * Meta must not be silently dropped, or Cmd+1 on a Mac fires a plain `1`
 *   binding the operator never assigned;
 * * case must normalise, or Shift+A is unreachable — the browser reports the
 *   key as `A` once Shift is held, but the operator recorded `a`.
 */
import { describe, expect, it } from 'vitest'
import {
  formatHotkey,
  hotkeyFromEvent,
  isTypingTarget,
  normalizeKey,
  parseHotkey,
  resolveHotkeyTarget,
} from '../hotkey'

const evt = (over: Partial<Parameters<typeof hotkeyFromEvent>[0]> = {}) => ({
  key: '1',
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...over,
})

describe('normalizeKey', () => {
  it('upper-cases single characters so a and A are one binding', () => {
    expect(normalizeKey('a')).toBe('A')
    expect(normalizeKey('A')).toBe('A')
  })

  it('leaves named keys alone', () => {
    expect(normalizeKey('F5')).toBe('F5')
    expect(normalizeKey('ArrowUp')).toBe('ArrowUp')
  })
})

describe('hotkeyFromEvent', () => {
  it('reads a bare key', () => {
    expect(hotkeyFromEvent(evt({ key: 'p' }))).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      key: 'P',
    })
  })

  it('reads every modifier combination', () => {
    expect(hotkeyFromEvent(evt({ ctrlKey: true, altKey: true, shiftKey: true }))).toEqual({
      ctrl: true,
      alt: true,
      shift: true,
      key: '1',
    })
  })

  it('ignores a bare modifier press', () => {
    // Holding Ctrl fires a keydown of its own; resolving it would match a
    // binding before the operator has pressed the real key.
    for (const key of ['Control', 'Alt', 'Shift', 'Meta']) {
      expect(hotkeyFromEvent(evt({ key }))).toBeNull()
    }
  })

  it('refuses anything with Meta held', () => {
    // Cmd is out of scope. Dropping the modifier would make Cmd+1 fire the
    // plain "1" binding on a Mac.
    expect(hotkeyFromEvent(evt({ key: '1', metaKey: true }))).toBeNull()
  })

  it('ignores an empty key', () => {
    expect(hotkeyFromEvent(evt({ key: '' }))).toBeNull()
  })
})

describe('formatHotkey / parseHotkey', () => {
  it('formats in the display order the mockup uses', () => {
    expect(formatHotkey({ ctrl: true, alt: true, shift: true, key: '1' })).toBe('Ctrl+Alt+Shift+1')
    expect(formatHotkey({ ctrl: false, alt: false, shift: false, key: 'P' })).toBe('P')
  })

  it('round-trips', () => {
    for (const s of ['Ctrl+1', 'Alt+Shift+P', 'F5', 'Ctrl+Alt+Shift+ArrowUp']) {
      expect(formatHotkey(parseHotkey(s)!)).toBe(s)
    }
  })

  it('round-trips keys that are themselves the separator', () => {
    // formatHotkey writes '+' as 'Ctrl++'. Splitting on every separator and
    // dropping the empties made that unreadable, so the module could produce a
    // combination it was unable to parse back.
    for (const s of ['+', 'Ctrl++', 'Shift++', 'Ctrl+Alt++']) {
      expect(formatHotkey(parseHotkey(s)!)).toBe(s)
    }
    expect(parseHotkey('+')).toEqual({ ctrl: false, alt: false, shift: false, key: '+' })
    expect(parseHotkey('Ctrl++')).toEqual({ ctrl: true, alt: false, shift: false, key: '+' })
  })

  it('rejects a string with no final key', () => {
    expect(parseHotkey('Ctrl')).toBeNull()
    expect(parseHotkey('Ctrl+Shift')).toBeNull()
    expect(parseHotkey('')).toBeNull()
  })

  it('rejects unknown modifiers', () => {
    expect(parseHotkey('Cmd+1')).toBeNull()
    expect(parseHotkey('Hyper+A')).toBeNull()
  })
})

describe('isTypingTarget', () => {
  const el = (html: string): Element => {
    const host = document.createElement('div')
    host.innerHTML = html
    return host.firstElementChild!
  }

  it('is true for text entry elements', () => {
    expect(isTypingTarget(el('<input />'))).toBe(true)
    expect(isTypingTarget(el('<textarea></textarea>'))).toBe(true)
    expect(isTypingTarget(el('<select></select>'))).toBe(true)
  })

  it('is true inside an open dialog, not only its inputs', () => {
    // A hotkey pressed while a modal is up must not reach the page behind it.
    const dialog = el('<div role="dialog"><button>Save</button></div>')
    expect(isTypingTarget(dialog.querySelector('button'))).toBe(true)
  })

  it('is false for ordinary page elements', () => {
    expect(isTypingTarget(el('<div>text</div>'))).toBe(false)
    expect(isTypingTarget(el('<button>Click</button>'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('resolveHotkeyTarget', () => {
  const bindings = { 'Ctrl+1': 101, P: 202 }

  it('resolves an assigned combination', () => {
    expect(resolveHotkeyTarget(evt({ key: '1', ctrlKey: true }), bindings)).toBe(101)
    expect(resolveHotkeyTarget(evt({ key: 'p' }), bindings)).toBe(202)
  })

  it('returns null for an unassigned combination', () => {
    // Per the ticket: nothing happens. No error, no modal.
    expect(resolveHotkeyTarget(evt({ key: '9' }), bindings)).toBeNull()
  })

  it('does not confuse a bare key with its modified form', () => {
    // "P" is bound; "Ctrl+P" is not, and must not fall through to it.
    expect(resolveHotkeyTarget(evt({ key: 'p', ctrlKey: true }), bindings)).toBeNull()
  })

  it('does not fire while the operator is typing', () => {
    const input = document.createElement('input')
    expect(resolveHotkeyTarget({ ...evt({ key: 'p' }), target: input }, bindings)).toBeNull()
  })

  it('returns null against an empty binding map', () => {
    expect(resolveHotkeyTarget(evt({ key: 'p' }), {})).toBeNull()
  })
})
