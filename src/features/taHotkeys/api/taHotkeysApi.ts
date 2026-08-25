import api from '@/lib/api'
import type { TAHotkeyAssignResult, TAHotkeyBinding } from './types'

/**
 * The current operator's bindings.
 *
 * No user id is passed — the server reads it from the token and will only ever
 * return the caller's own map. Bindings for templates the operator can no
 * longer reach are filtered out server-side, so anything returned here is safe
 * to fire (KAN-973 §2).
 */
export async function getTAHotkeys(): Promise<TAHotkeyBinding[]> {
  const r = await api.get<TAHotkeyBinding[]>('/api/v1/ta-hotkeys')
  return r.data
}

/**
 * Bind a combination to a template.
 *
 * Assigning a combination already in use moves it — the previous template
 * loses its shortcut. That is the expected outcome, not an error, so there is
 * no confirmation flag. The settings UI warns beforehand, but that warning is
 * built from a list that may be stale by the time it saves, so callers read
 * `reassigned_from` to learn what actually moved (KAN-975 §4).
 */
export async function assignTAHotkey(payload: {
  hotkey: string
  quick_pick_id: number
}): Promise<TAHotkeyAssignResult> {
  const r = await api.put<TAHotkeyAssignResult>('/api/v1/ta-hotkeys', payload)
  return r.data
}

/** Clear a template's shortcut. Succeeds even if it had none. */
export async function clearTAHotkey(quickPickId: number): Promise<void> {
  await api.delete(`/api/v1/ta-hotkeys/${quickPickId}`)
}
