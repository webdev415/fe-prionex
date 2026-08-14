/**
 * KAN-974 — whether a keypress inside the TA modal should save the interaction.
 *
 * Extracted from `ChainExecutor` for the same reason as the KAN-973 rules: the
 * component needs a rendered modal, a running chain instance and a live
 * mutation to exercise, whereas every question worth getting right here is
 * decidable from the event plus a handful of booleans.
 *
 * The rule it encodes is deliberately narrow. Enter is the most-pressed key on
 * the keyboard, and this modal writes to a client's permanent interaction
 * history — a save that fires when the operator meant something else is not
 * undoable from the UI. So every condition below has to hold, and anything
 * unrecognised falls through to "do nothing".
 */

/** Marks the free-text notes field, the one place Enter keeps its normal job. */
export const NOTES_FIELD_ATTR = 'data-ta-notes'

/** Which body the panel is showing, and so which save Enter is an alias for. */
export type EnterSaveMode = 'wizard' | 'instant' | null

/**
 * Which save Enter should call, mirroring the panel's render.
 *
 * The order matters and is not the intuitive one: an active instance means the
 * WIZARD is on screen even for a chain that qualifies for instant mode, because
 * instant mode is what a not-yet-started simple chain gets. Branching on
 * `isInstantMode` first would fire the instant save into a running instance —
 * and that is the common case for a hotkey launch, which starts a template and
 * so always has an instance.
 *
 * `null` means neither save is reachable: no chain picked, or a chain shown as
 * a preview because it has delays or branches and has not been started.
 */
export function resolveEnterSaveMode(params: {
  hasChain: boolean
  hasActiveInstance: boolean
  isInstantMode: boolean
}): EnterSaveMode {
  if (!params.hasChain) return null
  if (params.hasActiveInstance) return 'wizard'
  return params.isInstantMode ? 'instant' : null
}

export interface EnterSaveEvent {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  /** True when another handler (an open dropdown, say) already consumed it. */
  defaultPrevented: boolean
  target: EventTarget | null
}

/**
 * Whether this keypress should trigger the modal's save.
 *
 * `canSave` is the caller's answer to "is the Save button on screen and
 * enabled right now?" — Enter is an alias for clicking it, so it must not
 * reach further than the button does. Passing it in rather than reconstructing
 * the condition here keeps the two from drifting: the component owns which
 * step it is on and which mutation is in flight, and this owns the keyboard
 * rules.
 *
 * Returns false for:
 *
 * * any key but Enter, and any Enter held with a modifier. Ctrl+Enter as a
 *   submit-from-notes shortcut is an explicit non-goal of the ticket, and
 *   Shift+Enter is a newline everywhere else in the product — neither should
 *   quietly become a save.
 * * a press already handled by something else. Radix's Select *trigger* and its
 *   menu items do call `preventDefault` on Enter, so the flag catches those.
 * * a press inside an open dropdown list. This is NOT covered by the flag:
 *   Radix's SelectItem runs `handleSelect()` on Enter and preventDefaults only
 *   for Space (verified in @radix-ui/react-select), so choosing a value would
 *   otherwise submit the interaction at the same time. Portalled content still
 *   reaches this handler, because React bubbles portal events through the React
 *   tree rather than the DOM tree.
 * * a press inside the notes field. The ticket is explicit that Enter inserts
 *   a line break there; the operator saves by tabbing out first, or clicking.
 * * anything at all when the save is unavailable — wrong step, a mutation
 *   already in flight, a chain still finalising.
 */
export function decideEnterSave(params: { event: EnterSaveEvent; canSave: boolean }): boolean {
  const { event, canSave } = params

  if (event.key !== 'Enter') return false
  if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return false
  if (event.defaultPrevented) return false
  if (!canSave) return false
  if (isInsideOpenPopup(event.target)) return false
  if (isSelfActivating(event.target)) return false

  return !isNotesField(event.target)
}

/**
 * Whether a document-level press belongs to this executor.
 *
 * The listener is on the document rather than the panel because focus is not
 * reliably inside the panel: when the modal opens, Radix hands focus to the
 * dialog's own content wrapper, which *contains* the panel rather than sitting
 * within it. A panel-mounted handler never sees those presses, which is
 * "Enter does nothing" for an operator who has touched nothing yet.
 *
 * So the press is ours when it came from inside the panel, or from anywhere
 * inside the dialog the panel lives in. The dialog is the boundary, and
 * deliberately not `<body>`: three executors can be mounted at once (this
 * modal, the minimised bubble, the dialer's inline call panel), and `<body>`
 * contains every one of them. Accepting it would let a single Enter aimed at
 * nothing save an interaction in each — and the dialer's panel is not in a
 * dialog at all, so a stray press anywhere on that page would submit against a
 * live call.
 *
 * With no dialog ancestor the boundary collapses to the panel itself, which is
 * the conservative answer for exactly that inline case.
 *
 * The on-screen test comes first: a mounted but collapsed executor must not
 * answer for anything. `offsetParent` is null inside `position: fixed`
 * ancestors — which the modal's content is — hence the rect fallback.
 */
export function isPressForPanel(target: EventTarget | null, panel: HTMLElement | null): boolean {
  if (!panel || !panel.isConnected) return false

  const isOnScreen = panel.offsetParent !== null || panel.getClientRects().length > 0
  if (!isOnScreen) return false

  // An unattributable press is not ours. Rejecting is what keeps a second
  // mounted executor from answering for the same keystroke.
  if (!(target instanceof Node)) return false

  const boundary = panel.closest('[role="dialog"]') ?? panel
  return panel.contains(target) || boundary.contains(target)
}

/**
 * Elements that already do something with Enter when focused.
 *
 * A focused button is activated by Enter as the keydown's default action, so
 * saving *as well* would run two actions from one press — Enter on the modal's
 * Minimize button would minimise and save. Leaving these to their own behaviour
 * is also why the Save button needs no special case: its own click is the save,
 * and it happens exactly once.
 */
export function isSelfActivating(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  return target.closest('button, a[href], summary, [type="submit"], [type="button"]') !== null
}

/**
 * Roles that mean "a popup is open and this key belongs to it".
 *
 * Matched by ARIA role rather than by component, because the popup is the
 * thing we can recognise from the event alone — it may be portalled out of the
 * panel's DOM subtree while still bubbling here through the React tree, and it
 * may be any of several widgets (a value dropdown, the template menu).
 *
 * Includes roles whose libraries currently *do* preventDefault, deliberately.
 * The one case that reached production behaviour unguarded — SelectItem — did
 * so because a third party's internal choice about preventDefault is not a
 * contract, and reading the flag alone made this handler depend on it.
 */
const POPUP_ROLES = [
  'listbox',
  'option',
  'combobox',
  'menu',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
]

const POPUP_SELECTOR = POPUP_ROLES.map((role) => `[role="${role}"]`).join(', ')

/** Whether the press came from inside (or from the trigger of) an open popup. */
export function isInsideOpenPopup(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  return target.closest(POPUP_SELECTOR) !== null
}

/**
 * Whether the event landed in the notes field.
 *
 * Matched by attribute rather than by tag, because "is it a textarea" is the
 * wrong question: a Target Action can itself be a free-text field, and Enter
 * in one of those saves, per the ticket — notes is the single exception, so it
 * is the single thing marked.
 */
export function isNotesField(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  return target.closest(`[${NOTES_FIELD_ATTR}]`) !== null
}
