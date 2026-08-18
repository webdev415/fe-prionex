/** One operator's binding of a key combination to a quick-pick template. */
export interface TAHotkeyBinding {
  /**
   * Canonical combination string — modifiers in the order Ctrl, Alt, Shift,
   * then the final key. This is exactly what `formatHotkey` produces, which is
   * what lets the launch path use it as a lookup key with no parsing.
   */
  hotkey: string
  quick_pick_id: number
}

export interface TAHotkeyAssignResult extends TAHotkeyBinding {
  /**
   * The template that previously owned this combination, or `null` if it was
   * free.
   *
   * The settings UI warns before saving, but it builds that warning from a list
   * it fetched earlier — another tab, or the same operator on another machine,
   * may have moved the combination since. This is what actually happened, so
   * the row that lost its shortcut is the one the server names, not the one the
   * UI guessed.
   */
  reassigned_from: number | null
}
