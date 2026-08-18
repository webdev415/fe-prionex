/**
 * KAN-975 — the rules behind the "press the keys you want" box.
 *
 * Separated from the component for the same reason as the KAN-973 launch
 * rules: what the recorder shows and when it commits is decidable from a
 * keyboard event, while the component needs a rendered panel and a live query
 * to exercise.
 *
 * The recorder has three states, and the awkward one is the middle: while the
 * operator is still holding modifiers, nothing has been chosen yet, but the box
 * must show what they are holding or it looks broken.
 */
import { formatHotkey, hotkeyFromEvent, type Hotkey } from './hotkey'

/** Modifiers we record, in the order they are displayed. Cmd is out of scope. */
const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift'] as const

export type RecorderOutcome =
  /** Escape — put back whatever the template already had. */
  | { type: 'cancel' }
  /** Only modifiers so far; `label` is the live preview, e.g. "Ctrl + …". */
  | { type: 'partial'; label: string }
  /** A real key landed; `hotkey` is canonical and ready to save. */
  | { type: 'commit'; hotkey: string; label: string }
  /** Nothing we act on — a bare Meta press, or a key we cannot record. */
  | { type: 'ignore' }

export interface RecorderEvent {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/** The modifiers held, in display order. */
function heldModifiers(event: RecorderEvent): string[] {
  const held: string[] = []
  if (event.ctrlKey) held.push('Ctrl')
  if (event.altKey) held.push('Alt')
  if (event.shiftKey) held.push('Shift')
  return held
}

/**
 * How a combination reads to a human: spaced around the plus signs.
 *
 * Deliberately not the same string we store. `formatHotkey` produces the
 * canonical `Ctrl+1` the server and the launch path compare on; this is for
 * the box and the key pills, where `Ctrl + 1` is easier to read. Keeping them
 * apart stops a display tweak from silently changing what gets saved.
 */
export function describeHotkey(hotkey: string): string {
  return hotkey.split('+').join(' + ')
}

/** The pills a badge shows — one per part of the combination. */
export function hotkeyParts(hotkey: string): string[] {
  return hotkey.split('+').filter(Boolean)
}

/**
 * What a keypress inside the recorder means.
 *
 * Escape is checked before anything else so it cancels even mid-combination —
 * an operator who starts recording by mistake should not have to complete a
 * combination to get out.
 *
 * A bare modifier press yields `partial`, never `commit`: the first key that is
 * *not* a modifier is what ends the recording. Holding Ctrl alone must not
 * assign Ctrl to anything.
 */
export function readRecorderKey(event: RecorderEvent): RecorderOutcome {
  if (event.key === 'Escape') return { type: 'cancel' }

  const held = heldModifiers(event)
  const isModifierPress = MODIFIER_ORDER.includes(event.key as (typeof MODIFIER_ORDER)[number])
    ? true
    : ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock'].includes(event.key)

  if (isModifierPress) {
    // "Ctrl + …" tells the operator the box is listening and what it has so
    // far. With nothing held there is nothing to show, so the caller keeps its
    // "Press keys…" prompt.
    return held.length > 0
      ? { type: 'partial', label: `${held.join(' + ')} + …` }
      : { type: 'ignore' }
  }

  const hotkey: Hotkey | null = hotkeyFromEvent(event)
  // `hotkeyFromEvent` refuses anything with Meta held — Cmd is out of scope,
  // and dropping the modifier silently would record a combination the operator
  // did not press.
  if (!hotkey) return { type: 'ignore' }

  const formatted = formatHotkey(hotkey)
  return { type: 'commit', hotkey: formatted, label: describeHotkey(formatted) }
}

/**
 * The template that already owns this combination, or `null`.
 *
 * Excludes the template being edited: re-recording the same keys onto the
 * template that already has them is not a conflict, and warning about it would
 * be nonsense ("already used by the thing you are editing").
 */
export function findConflict(params: {
  hotkey: string
  editingQuickPickId: number | null
  bindings: Array<{ hotkey: string; quick_pick_id: number }>
}): number | null {
  const { hotkey, editingQuickPickId, bindings } = params
  const clash = bindings.find((b) => b.hotkey === hotkey && b.quick_pick_id !== editingQuickPickId)
  return clash ? clash.quick_pick_id : null
}
