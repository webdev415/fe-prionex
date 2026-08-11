/**
 * KAN-973 — key-combination handling for TA template quick-launch.
 *
 * Pure on purpose: the listener that consumes this lives on the Client Card and
 * needs a rendered page to test, whereas every rule worth getting right is
 * decidable from a keyboard event alone. Keeping them apart is what let the
 * KAN-977 rules be tested without standing up the whole modal.
 *
 * Scope per the ticket: Ctrl / Alt / Shift plus one final key. Cmd/Meta is
 * explicitly out of scope for now — see `hotkeyFromEvent` for what that means
 * for Mac users.
 */

/** A recorded combination. ``key`` is the final, non-modifier key. */
export interface Hotkey {
  ctrl: boolean
  alt: boolean
  shift: boolean
  /** Normalised final key: single characters upper-cased, named keys verbatim. */
  key: string
}

/** Modifier keys never count as the final key of a combination. */
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock'])

/**
 * Normalise a raw ``KeyboardEvent.key`` into the form we store and compare.
 *
 * Single printable characters are upper-cased so ``a`` and ``A`` are the same
 * binding — otherwise Shift+A would be unreachable (the browser reports the key
 * as ``A`` once Shift is held, and the operator would have recorded ``a``).
 * Named keys (``F5``, ``ArrowUp``, ``Enter``) already have a stable spelling and
 * are kept verbatim.
 */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key
}

/**
 * The combination a keyboard event represents, or ``null`` when the event
 * cannot be one.
 *
 * Returns ``null`` for:
 *
 * * a bare modifier press — holding Ctrl fires a keydown whose ``key`` is
 *   ``Control``; treating that as a combination would match a binding the
 *   instant a modifier is touched, before the operator has chosen a key.
 * * anything with Meta held. Cmd is out of scope, and silently dropping the
 *   modifier would make Cmd+1 fire a plain ``1`` binding on a Mac — a
 *   keystroke the operator never assigned.
 */
export function hotkeyFromEvent(event: {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}): Hotkey | null {
  if (MODIFIER_KEYS.has(event.key)) return null
  if (event.metaKey) return null
  if (!event.key) return null

  return {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    key: normalizeKey(event.key),
  }
}

/**
 * Canonical string form — the storage key and the display order the mockup
 * uses (Ctrl, then Alt, then Shift, then the key).
 *
 * Storing the formatted string rather than the object means a mapping is a
 * plain ``Record<string, templateId>``, which gets "one combination binds one
 * template" for free: assigning an existing combination overwrites the entry.
 */
export function formatHotkey(hotkey: Hotkey): string {
  const parts: string[] = []
  if (hotkey.ctrl) parts.push('Ctrl')
  if (hotkey.alt) parts.push('Alt')
  if (hotkey.shift) parts.push('Shift')
  parts.push(hotkey.key)
  return parts.join('+')
}

/** Inverse of {@link formatHotkey}. ``null`` when the string is not a combination. */
export function parseHotkey(value: string): Hotkey | null {
  const parts = value.split('+').filter(Boolean)
  if (parts.length === 0) return null

  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)
  if (MODIFIER_KEYS.has(key) || ['Ctrl', 'Alt', 'Shift'].includes(key)) return null
  if (!modifiers.every((m) => ['Ctrl', 'Alt', 'Shift'].includes(m))) return null

  return {
    ctrl: modifiers.includes('Ctrl'),
    alt: modifiers.includes('Alt'),
    shift: modifiers.includes('Shift'),
    key: normalizeKey(key),
  }
}

/** Element names that own their keystrokes. */
const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Whether a keydown must be ignored because the operator is typing.
 *
 * This is what makes bare-key bindings usable at all: with ``a`` assigned,
 * every letter typed into a search box or a notes field would otherwise launch
 * a modal. The ticket lists search fields, notes, amount/date inputs and open
 * modals explicitly.
 *
 * ``closest`` covers the modal case in one step — anything inside an element
 * marked ``role="dialog"`` is off-limits, including its buttons, not just its
 * inputs. A hotkey pressed while a dialog is up should never reach the page
 * behind it.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  if (TEXT_ENTRY_TAGS.has(target.tagName)) return true
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return target.closest('[role="dialog"], [contenteditable="true"]') !== null
}

/**
 * The template bound to this event, or ``null``.
 *
 * ``bindings`` is keyed by {@link formatHotkey} output. An unassigned
 * combination returns ``null`` and the caller does nothing — no error, no
 * modal, per the ticket.
 */
export function resolveHotkeyTarget<T>(
  event: {
    key: string
    ctrlKey: boolean
    altKey: boolean
    shiftKey: boolean
    metaKey: boolean
    target?: EventTarget | null
  },
  bindings: Record<string, T>
): T | null {
  if (isTypingTarget(event.target ?? null)) return null

  const hotkey = hotkeyFromEvent(event)
  if (!hotkey) return null

  return bindings[formatHotkey(hotkey)] ?? null
}
