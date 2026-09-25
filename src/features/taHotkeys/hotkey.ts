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
 * Keys that already carry universal activation semantics.
 *
 * The launch path calls ``preventDefault`` on any combination it recognises, so
 * honouring a binding on one of these would stop it working everywhere focus is
 * not a text field: Enter on a focused button, Space on a checkbox, Tab out of
 * a control, Escape out of a popover. Refused here on the READ side, so such a
 * binding can never be honoured even if one reaches the client — the assign UI
 * in KAN-975 should refuse to record them too, but that guard has to hold
 * independently of a screen that does not ship yet.
 *
 * ``parseHotkey`` deliberately still reads them back: a stored binding that
 * should never have existed has to stay visible in the settings list, or the
 * operator cannot see it to delete it.
 */
const ACTIVATION_KEYS = new Set(['Enter', ' ', 'Spacebar', 'Tab', 'Escape', 'Esc'])

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
 * Latin characters we can map back to the physical key that produces them.
 *
 * Only needed for the fallback below: real browser events carry ``code``. A
 * synthetic event (a test, an on-screen keyboard, some IME paths) may not, and
 * silently producing a different spelling from the same keystroke would create
 * a second, unmatchable row for one button — the exact bug this change fixes.
 */
function codeFromChar(char: string): string | null {
  if (/^[A-Z]$/.test(char)) return `Key${char}`
  if (/^[0-9]$/.test(char)) return `Digit${char}`
  return null
}

/**
 * The physical key an event names — ``event.code``, with a fallback.
 *
 * Named keys (``F2``, ``ArrowUp``, ``Enter``) are spelled the same in ``key``
 * and ``code``, so the fallback returns them unchanged and old stored bindings
 * for them keep matching without migration.
 */
export function physicalKey(event: { key: string; code?: string }): string {
  if (event.code) return event.code
  const normalized = normalizeKey(event.key)
  return codeFromChar(normalized) ?? normalized
}

/**
 * How a physical key reads to a human: ``KeyD`` -> ``D``, ``Digit1`` -> ``1``.
 *
 * Display only — never stored, never compared. The operator sees the legend on
 * their keycap; the storage layer keeps the position. Anything we do not
 * recognise (``F2``, ``ArrowUp``) is already human-readable and passes through.
 */
export function displayKey(key: string): string {
  const letter = /^Key([A-Z])$/.exec(key)
  if (letter) return letter[1]
  const digit = /^Digit([0-9])$/.exec(key)
  if (digit) return digit[1]
  const numpad = /^Numpad([0-9])$/.exec(key)
  if (numpad) return `Num ${numpad[1]}`
  return key
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
 *
 * Reads ``event.code`` — the PHYSICAL key — not ``event.key``, so a binding is
 * the button, not the letter printed on it. This is what the earlier rounds of
 * KAN-973 deferred; it lands here with the KAN-975 settings tab and revision
 * 163, exactly where the deferral said it belonged.
 *
 * Why it had to change: on a Ukrainian layout the button labelled ``D`` reports
 * ``event.key === 'В'``. Storing the letter meant one physical button could
 * hold TWO different bindings — ``D`` recorded on Latin and ``В`` on Cyrillic —
 * with no conflict warning, because the two strings differ. Operators hit this
 * in the field (KAN-975 follow-up). Reading ``code`` collapses both to
 * ``KeyD``, so the existing conflict check and the ``(user_id, hotkey)``
 * unique constraint start catching it, and a binding keeps firing after the
 * operator switches layout mid-session.
 *
 * The cost, stated plainly: a binding now follows the physical POSITION. On a
 * French AZERTY keyboard the key an operator sees as ``A`` reports ``KeyQ`` and
 * would display as ``Q``. Accepted deliberately — operators here run Ukrainian
 * and English on the same QWERTY hardware, where position and legend agree.
 *
 * Named keys need no translation: ``F2``, ``ArrowUp``, ``Enter``, ``Home`` and
 * friends are spelled identically in ``key`` and ``code``, so only single
 * characters ever had to be migrated (``S`` -> ``KeyS``, ``1`` -> ``Digit1``).
 */
export function hotkeyFromEvent(event: {
  key: string
  /** ``KeyboardEvent.code``. Optional so synthetic events stay constructible. */
  code?: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}): Hotkey | null {
  // The modifier and activation guards stay on ``key``: those spellings
  // ('Control', 'Enter', 'Escape') are already layout-independent, and a
  // modifier's ``code`` distinguishes left from right ('ShiftLeft'), which
  // would let a bare Shift press through as a final key.
  if (MODIFIER_KEYS.has(event.key)) return null
  if (ACTIVATION_KEYS.has(event.key)) return null
  if (event.metaKey) return null
  if (!event.key && !event.code) return null

  const key = physicalKey(event)
  if (!key) return null

  return {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    key,
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
  if (!value) return null

  // Split on the LAST separator, not every one. Splitting on all of them and
  // dropping empties made '+' unparseable — `formatHotkey` produces 'Ctrl++'
  // for it, which collapsed to ['Ctrl'] and returned null, so a combination
  // this module can write it could not read back.
  // dropping the empties made '+' unparseable — `formatHotkey` writes it as
  // 'Ctrl++', which collapsed to ['Ctrl'] and returned null, so this module
  // could produce a combination it was unable to read back.
  const lastSeparator = value.lastIndexOf('+')
  const key = lastSeparator === -1 ? value : value.slice(lastSeparator + 1) || '+'
  const modifiers =
    lastSeparator <= 0
      ? []
      : value
          .slice(0, key === '+' ? lastSeparator - 1 : lastSeparator)
          .split('+')
          .filter(Boolean)

  if (!key) return null
  if (MODIFIER_KEYS.has(key) || ['Ctrl', 'Alt', 'Shift'].includes(key)) return null
  if (!modifiers.every((m) => ['Ctrl', 'Alt', 'Shift'].includes(m))) return null

  return {
    ctrl: modifiers.includes('Ctrl'),
    alt: modifiers.includes('Alt'),
    shift: modifiers.includes('Shift'),
    key: normalizeKey(key),
  }
}

/**
 * Marks the TA executor's own dialog.
 *
 * A class rather than a data attribute because the Modal primitive forwards
 * ``className`` to the Radix dialog element and nothing else — and the marker
 * has to sit on an ancestor of whatever holds focus, which is that element.
 */
export const TA_EXECUTOR_DIALOG_CLASS = 'ta-executor-dialog'

/** Selector form of {@link TA_EXECUTOR_DIALOG_CLASS}. */
export const TA_EXECUTOR_DIALOG_SELECTOR = `.${TA_EXECUTOR_DIALOG_CLASS}`

/**
 * Marks a popup that silences quick-launch for as long as it is on screen.
 *
 * The focus rules below cannot cover these on their own. Focus leaves a popup
 * without it closing: a click on a heading or padding lands on something that
 * cannot take focus, and a row that re-renders elsewhere drops the focus it
 * held. Either way the keydown target becomes ``body``, which is not typing,
 * and a bound key launched a template over the still-open popup. Checking for
 * the popup itself does not depend on where focus ended up.
 */
export const HOTKEY_BLOCKING_ATTR = 'data-blocks-hotkeys'

/**
 * Marks a popup trigger that does not consume keys itself.
 *
 * ``[aria-haspopup]`` normally counts as owning its keystrokes, because a Radix
 * Select trigger uses type-ahead even while collapsed. A plain trigger such as
 * the assignee pencil has none, so it owns keys only while its popup is open
 * (``aria-expanded="true"``) and passes them through once it is closed.
 */
export const HOTKEY_PASSTHROUGH_TRIGGER_ATTR = 'data-hotkey-passthrough-trigger'

/** Whether any element carrying {@link HOTKEY_BLOCKING_ATTR} is mounted. */
export function isHotkeyBlockingPopupOpen(root: ParentNode = document): boolean {
  return root.querySelector(`[${HOTKEY_BLOCKING_ATTR}]`) !== null
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
 *
 * Popup widgets are checked through {@link ownsItsKeystrokes} for the same
 * reason the exempt-dialog path checks them: a keystroke belongs to the
 * control the operator is looking at. The dialog rule alone does not reach
 * them — a Radix ``Select`` portals its listbox to the body, so on the client
 * card it sits outside every dialog. Without this a bare-key binding such as
 * ``P`` is taken from the dropdown's type-ahead and opens the TA modal
 * instead of choosing the option the operator was aiming at.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (ownsItsKeystrokes(target)) return true
  if (!target || !(target instanceof Element)) return false
  return target.closest('[role="dialog"], [contenteditable="true"]') !== null
}

/**
 * The narrower half of {@link isTypingTarget}: the element itself takes text.
 *
 * Split out so a dialog can be exempted from the "inside a dialog counts as
 * typing" rule without also un-protecting the inputs within it.
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  if (TEXT_ENTRY_TAGS.has(target.tagName)) return true
  return target instanceof HTMLElement && target.isContentEditable
}

/**
 * Controls that consume plain keys themselves.
 *
 * Text fields are the obvious case, but not the only one: a Radix dropdown
 * trigger is a ``button[role="combobox"]`` and its list uses type-ahead, so a
 * bare-key binding like ``P`` would be stolen from the widget — the operator
 * types to jump to an option and gets a toast instead.
 *
 * Used on both sides of the dialog rule. Inside an exempt dialog it is what
 * stops the exemption at the widgets (dropdowns are the main interaction in
 * the TA modal); outside one it is reached through {@link isTypingTarget},
 * because a portalled listbox on the client card belongs to no dialog at all.
 */
export function ownsItsKeystrokes(target: EventTarget | null): boolean {
  if (isTextEntryTarget(target)) return true
  if (!target || !(target instanceof Element)) return false
  const owner = target.closest(
    '[role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"], [aria-haspopup]'
  )
  if (owner === null) return false
  // A trigger that does no type-ahead of its own gives keys back while its
  // popup is closed. Focus returns to it on close, so without this every
  // binding stayed silent until the operator clicked somewhere else.
  if (owner.hasAttribute(HOTKEY_PASSTHROUGH_TRIGGER_ATTR)) {
    return owner.getAttribute('aria-expanded') === 'true'
  }
  return true
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
    code?: string
    ctrlKey: boolean
    altKey: boolean
    shiftKey: boolean
    metaKey: boolean
    target?: EventTarget | null
  },
  bindings: Record<string, T>,
  options?: {
    /**
     * Dialogs this feature owns, which therefore should not silence a bound
     * key. Selector matched against the target's ancestors.
     *
     * Needed because ``isTypingTarget`` treats everything inside a
     * ``role="dialog"`` as typing, and the TA modal traps focus inside itself.
     * With no exemption a hotkey pressed while that modal is open was
     * swallowed here, so the "one modal at a time" toast the ticket asks for
     * could never fire — the operator pressed their key and got silence, which
     * is the exact outcome the guard exists to prevent.
     */
    exemptDialogSelector?: string
  }
): T | null {
  const exempt =
    options?.exemptDialogSelector != null &&
    event.target instanceof Element &&
    event.target.closest(options.exemptDialogSelector) !== null

  if (!exempt && isTypingTarget(event.target ?? null)) return null
  // Even inside an exempt dialog, a key aimed at a control that consumes keys
  // still belongs to that control. The exemption is about the dialog wrapper,
  // not the widgets inside it.
  if (exempt && ownsItsKeystrokes(event.target ?? null)) return null

  const hotkey = hotkeyFromEvent(event)
  if (!hotkey) return null

  return bindings[formatHotkey(hotkey)] ?? null
}
