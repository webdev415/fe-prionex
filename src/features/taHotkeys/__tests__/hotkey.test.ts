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
  displayKey,
  formatHotkey,
  HOTKEY_PASSTHROUGH_TRIGGER_ATTR,
  hotkeyFromEvent,
  isTypingTarget,
  normalizeKey,
  parseHotkey,
  physicalKey,
  resolveHotkeyTarget,
} from '../hotkey'

// `code` is what gets stored, so fixtures carry both halves of a real event:
// the character the layout produced and the button that produced it.
const evt = (over: Partial<Parameters<typeof hotkeyFromEvent>[0]> = {}) => ({
  key: '1',
  code: 'Digit1',
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
  it('reads a bare key as the physical key, not the character', () => {
    expect(hotkeyFromEvent(evt({ key: 'p', code: 'KeyP' }))).toEqual({
      ctrl: false,
      alt: false,
      shift: false,
      key: 'KeyP',
    })
  })

  it('reads every modifier combination', () => {
    expect(hotkeyFromEvent(evt({ ctrlKey: true, altKey: true, shiftKey: true }))).toEqual({
      ctrl: true,
      alt: true,
      shift: true,
      key: 'Digit1',
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

  it('ignores an event that names no key at all', () => {
    expect(hotkeyFromEvent(evt({ key: '', code: '' }))).toBeNull()
  })

  it('refuses keys that already activate the focused control', () => {
    // The launch path preventDefaults every combination it recognises, so
    // honouring one of these would break Enter on a button, Space on a
    // checkbox, or Tab out of a control anywhere on the client card.
    for (const key of ['Enter', ' ', 'Spacebar', 'Tab', 'Escape', 'Esc']) {
      expect(hotkeyFromEvent(evt({ key, ctrlKey: true }))).toBeNull()
      expect(hotkeyFromEvent(evt({ key }))).toBeNull()
    }
  })

  it('still reads an activation key back from a stored binding', () => {
    // Refusing on the read side must not make an already-stored binding
    // invisible: the settings list has to render it for the operator to
    // delete it.
    expect(parseHotkey('Ctrl+Enter')).toEqual({
      ctrl: true,
      alt: false,
      shift: false,
      key: 'Enter',
    })
  })
})

describe('formatHotkey / parseHotkey', () => {
  it('formats in the display order the mockup uses', () => {
    expect(formatHotkey({ ctrl: true, alt: true, shift: true, key: 'Digit1' })).toBe(
      'Ctrl+Alt+Shift+Digit1'
    )
    expect(formatHotkey({ ctrl: false, alt: false, shift: false, key: 'KeyP' })).toBe('KeyP')
  })

  it('round-trips', () => {
    for (const s of ['Ctrl+Digit1', 'Alt+Shift+KeyP', 'F5', 'Ctrl+Alt+Shift+ArrowUp']) {
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

  it('is true inside a popup that belongs to no dialog', () => {
    // A Radix Select portals its listbox to the body, so on the client card it
    // is outside every `role="dialog"`. The dialog rule alone therefore misses
    // it, and a bare-key binding would be taken from the widget's type-ahead:
    // the operator presses `P` to jump to an option and gets the TA modal.
    const listbox = el('<div role="listbox"><div role="option">Phone</div></div>')
    expect(isTypingTarget(listbox)).toBe(true)
    expect(isTypingTarget(listbox.querySelector('[role="option"]'))).toBe(true)
    expect(isTypingTarget(el('<button role="combobox">Choose</button>'))).toBe(true)
    expect(isTypingTarget(el('<button aria-haspopup="menu">More</button>'))).toBe(true)
  })

  it('lets a pass-through trigger give keys back only while its popup is closed', () => {
    // Focus returns to the assignee pencil when its popover closes. It has
    // `aria-haspopup` but no type-ahead, so once collapsed it must not keep
    // every binding silent.
    const closed = el(
      `<button aria-haspopup="listbox" aria-expanded="false" ${HOTKEY_PASSTHROUGH_TRIGGER_ATTR}>Edit</button>`
    )
    const open = el(
      `<button aria-haspopup="listbox" aria-expanded="true" ${HOTKEY_PASSTHROUGH_TRIGGER_ATTR}>Edit</button>`
    )
    expect(isTypingTarget(closed)).toBe(false)
    expect(isTypingTarget(open)).toBe(true)
    // Unmarked triggers keep the old rule, collapsed or not: a Radix Select
    // trigger type-aheads even while closed.
    expect(
      isTypingTarget(el('<button aria-haspopup="listbox" aria-expanded="false">Pick</button>'))
    ).toBe(true)
  })

  it('is false for ordinary page elements', () => {
    expect(isTypingTarget(el('<div>text</div>'))).toBe(false)
    expect(isTypingTarget(el('<button>Click</button>'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('resolveHotkeyTarget', () => {
  const bindings = { 'Ctrl+Digit1': 101, KeyP: 202 }

  it('resolves an assigned combination', () => {
    expect(resolveHotkeyTarget(evt({ key: '1', ctrlKey: true }), bindings)).toBe(101)
    expect(resolveHotkeyTarget(evt({ key: 'p', code: 'KeyP' }), bindings)).toBe(202)
  })

  it('returns null for an unassigned combination', () => {
    // Per the ticket: nothing happens. No error, no modal.
    expect(resolveHotkeyTarget(evt({ key: '9', code: 'Digit9' }), bindings)).toBeNull()
  })

  it('does not confuse a bare key with its modified form', () => {
    // "KeyP" is bound; "Ctrl+KeyP" is not, and must not fall through to it.
    expect(resolveHotkeyTarget(evt({ key: 'p', code: 'KeyP', ctrlKey: true }), bindings)).toBeNull()
  })

  it('does not fire while the operator is typing', () => {
    const input = document.createElement('input')
    expect(
      resolveHotkeyTarget({ ...evt({ key: 'p', code: 'KeyP' }), target: input }, bindings)
    ).toBeNull()
  })

  it('does not steal a keystroke aimed at an open dropdown', () => {
    // The page behind the dropdown has no dialog, so nothing else suppresses
    // this press. `P` is bound; the operator meant the option, not the modal.
    const host = document.createElement('div')
    host.innerHTML = '<div role="listbox"><div role="option">Phone</div></div>'
    const option = host.querySelector('[role="option"]')!
    expect(
      resolveHotkeyTarget({ ...evt({ key: 'p', code: 'KeyP' }), target: option }, bindings)
    ).toBeNull()
  })

  it('returns null against an empty binding map', () => {
    expect(resolveHotkeyTarget(evt({ key: 'p', code: 'KeyP' }), {})).toBeNull()
  })
})

// ── Layout independence (KAN-975 follow-up) ─────────────────────────────────
// The bug operators hit: the button labelled D reports `В` on a Ukrainian
// layout. Storing the character let one button hold two bindings under two
// spellings, so neither the conflict warning nor the unique constraint caught
// it. These pin that one button now means one binding, whatever the layout.
describe('layout independence', () => {
  const LATIN = { key: 'd', code: 'KeyD' }
  const CYRILLIC = { key: 'в', code: 'KeyD' }

  it('gives the same binding for one button on either layout', () => {
    expect(hotkeyFromEvent(evt(LATIN))).toEqual(hotkeyFromEvent(evt(CYRILLIC)))
    expect(formatHotkey(hotkeyFromEvent(evt(LATIN))!)).toBe('KeyD')
    expect(formatHotkey(hotkeyFromEvent(evt(CYRILLIC))!)).toBe('KeyD')
  })

  it('fires a binding recorded on one layout while the other is active', () => {
    // The half of the bug nobody reported: shortcuts recorded in English
    // silently stopped working the moment an operator switched to Ukrainian.
    const bindings = { KeyD: 7 }
    expect(resolveHotkeyTarget(evt(LATIN), bindings)).toBe(7)
    expect(resolveHotkeyTarget(evt(CYRILLIC), bindings)).toBe(7)
  })

  it('still separates two genuinely different buttons', () => {
    const bindings = { KeyD: 7, KeyF: 8 }
    expect(resolveHotkeyTarget(evt({ key: 'f', code: 'KeyF' }), bindings)).toBe(8)
  })
})

describe('physicalKey', () => {
  it('prefers the code the browser reports', () => {
    expect(physicalKey({ key: 'в', code: 'KeyD' })).toBe('KeyD')
  })

  it('falls back to the character when an event carries no code', () => {
    // Synthetic events, on-screen keyboards and some IME paths omit `code`.
    // Producing a different spelling from the same button would create a
    // second, unmatchable row — the exact bug this change removes.
    expect(physicalKey({ key: 's' })).toBe('KeyS')
    expect(physicalKey({ key: '1' })).toBe('Digit1')
  })

  it('leaves named keys alone, which is why they needed no migration', () => {
    expect(physicalKey({ key: 'F2' })).toBe('F2')
    expect(physicalKey({ key: 'ArrowUp' })).toBe('ArrowUp')
  })
})

describe('displayKey', () => {
  it('shows the legend on the keycap, not the stored position', () => {
    expect(displayKey('KeyD')).toBe('D')
    expect(displayKey('Digit1')).toBe('1')
    expect(displayKey('Numpad4')).toBe('Num 4')
  })

  it('passes through anything already readable', () => {
    expect(displayKey('F2')).toBe('F2')
    expect(displayKey('ArrowUp')).toBe('ArrowUp')
    expect(displayKey('Ctrl')).toBe('Ctrl')
  })
})
