import { describe, expect, it } from 'vitest'
import {
  describeHotkey,
  findConflict,
  hotkeyParts,
  readRecorderKey,
  type RecorderEvent,
} from '../shortcutRecorder'

function press(overrides: Partial<RecorderEvent> = {}): RecorderEvent {
  return {
    key: 'a',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides,
  }
}

describe('readRecorderKey', () => {
  it('commits on the first non-modifier key', () => {
    expect(readRecorderKey(press({ key: '1', ctrlKey: true }))).toEqual({
      type: 'commit',
      hotkey: 'Ctrl+1',
      label: 'Ctrl + 1',
    })
  })

  it('commits a bare key with no modifiers', () => {
    // The ticket allows a combination with zero modifiers.
    expect(readRecorderKey(press({ key: 'F2' }))).toEqual({
      type: 'commit',
      hotkey: 'F2',
      label: 'F2',
    })
  })

  it('upper-cases a single character so a and A are one binding', () => {
    // Otherwise Shift+A would be unreachable: the browser reports "A" once
    // Shift is held, and the operator would have recorded "a".
    expect(readRecorderKey(press({ key: 'a' }))).toMatchObject({ hotkey: 'A' })
    expect(readRecorderKey(press({ key: 'A', shiftKey: true }))).toMatchObject({
      hotkey: 'Shift+A',
    })
  })

  it('shows what is held while only modifiers are down', () => {
    // Without this the box looks frozen while the operator reaches for the key.
    expect(readRecorderKey(press({ key: 'Control', ctrlKey: true }))).toEqual({
      type: 'partial',
      label: 'Ctrl + …',
    })
    expect(
      readRecorderKey(press({ key: 'Shift', ctrlKey: true, altKey: true, shiftKey: true }))
    ).toEqual({ type: 'partial', label: 'Ctrl + Alt + Shift + …' })
  })

  it('never commits a modifier as the final key', () => {
    for (const key of ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock']) {
      expect(readRecorderKey(press({ key })).type).not.toBe('commit')
    }
  })

  it('cancels on Escape, even mid-combination', () => {
    expect(readRecorderKey(press({ key: 'Escape' }))).toEqual({ type: 'cancel' })
    expect(readRecorderKey(press({ key: 'Escape', ctrlKey: true, altKey: true }))).toEqual({
      type: 'cancel',
    })
  })

  it('ignores anything with Cmd held', () => {
    // Cmd is out of scope. Recording it as a plain "1" would assign a
    // combination the operator never pressed.
    expect(readRecorderKey(press({ key: '1', metaKey: true }))).toEqual({ type: 'ignore' })
  })

  it('ignores a bare modifier with nothing held', () => {
    // A keyup-ish edge: the box keeps its own "Press keys…" prompt.
    expect(readRecorderKey(press({ key: 'Meta' }))).toEqual({ type: 'ignore' })
  })
})

describe('display helpers', () => {
  it('spaces a stored combination for reading', () => {
    // The stored form stays canonical; only the display is spaced.
    expect(describeHotkey('Ctrl+Shift+A')).toBe('Ctrl + Shift + A')
    expect(describeHotkey('F2')).toBe('F2')
  })

  it('splits a combination into badge pills', () => {
    expect(hotkeyParts('Ctrl+1')).toEqual(['Ctrl', '1'])
    expect(hotkeyParts('F2')).toEqual(['F2'])
  })
})

describe('findConflict', () => {
  const bindings = [
    { hotkey: 'Ctrl+1', quick_pick_id: 10 },
    { hotkey: 'Alt+2', quick_pick_id: 11 },
  ]

  it('names the template already using the combination', () => {
    expect(findConflict({ hotkey: 'Ctrl+1', editingQuickPickId: 99, bindings })).toBe(10)
  })

  it('is silent when the combination is free', () => {
    expect(findConflict({ hotkey: 'Ctrl+9', editingQuickPickId: 99, bindings })).toBeNull()
  })

  it('does not call a template a conflict with itself', () => {
    // Re-recording the same keys onto the template that already has them would
    // otherwise warn "already used by" the row being edited.
    expect(findConflict({ hotkey: 'Ctrl+1', editingQuickPickId: 10, bindings })).toBeNull()
  })

  it('handles nothing being selected yet', () => {
    expect(findConflict({ hotkey: 'Ctrl+1', editingQuickPickId: null, bindings })).toBe(10)
  })
})
