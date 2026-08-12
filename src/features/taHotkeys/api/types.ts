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

// The assign response also carries `reassigned_from` — the template that lost
// this combination. It is typed alongside the assign call in KAN-975, which is
// where the first caller for it lives.
