import api from '@/lib/api'
import type { TAHotkeyBinding } from './types'

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

// The write side — PUT /api/v1/ta-hotkeys and DELETE /api/v1/ta-hotkeys/{id} —
// exists and is tested on the server, but has no caller here until KAN-975 adds
// the Profile Settings tab. It is declared there, with the UI that uses it,
// rather than sitting unused and unexercised in this PR.
