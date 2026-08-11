/**
 * ============================================================================
 * TEMPORARY — NOT THE REAL BINDING STORAGE. DO NOT SHIP AS-IS.
 * ============================================================================
 *
 * KAN-973 needs a per-operator map of `hotkey string -> quick-pick template id`.
 * Where that map is persisted is still undecided between KAN-973 and KAN-975
 * (open question with the client), so this stands in for it and reads a map an
 * operator cannot create through any UI.
 *
 * It exists so the launch path — listener, focus guard, single-modal guard,
 * auto-start — can be exercised in a real browser before the storage lands. It
 * is deliberately read-only and seeded by hand from the devtools console:
 *
 *   localStorage.setItem('ta-hotkeys.TEMP', JSON.stringify({ 'Ctrl+1': 12 }))
 *
 * ...where 12 is a quick-pick template id (`/quick-picks`, or the id in the
 * template picker's network response).
 *
 * REPLACING THIS: swap the body of `useTAHotkeyBindings` for the real query.
 * The return shape is the contract, and nothing else imports this file, so no
 * caller changes. Delete the file and this header goes with it.
 *
 * Not covered by tests on purpose — testing a stand-in encourages keeping it.
 * The rules it feeds (`hotkey.ts`, `decideHotkeyLaunch.ts`) are fully tested.
 */
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'ta-hotkeys.TEMP'

const EMPTY: Record<string, number> = {}

/** Cached so `getSnapshot` is referentially stable between storage writes. */
let cached: { raw: string | null; parsed: Record<string, number> } = {
  raw: null,
  parsed: EMPTY,
}

function readBindings(): Record<string, number> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === cached.raw) return cached.parsed

  let parsed: Record<string, number> = EMPTY
  try {
    const value: unknown = raw ? JSON.parse(raw) : null
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Keep only entries that look like `hotkey -> template id`; a hand-typed
      // seed is easy to get wrong and a bad entry should not break the page.
      parsed = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).filter(
          ([, id]) => typeof id === 'number' && Number.isFinite(id)
        )
      ) as Record<string, number>
    }
  } catch {
    parsed = EMPTY
  }

  cached = { raw, parsed }
  return parsed
}

function subscribe(onChange: () => void): () => void {
  // `storage` only fires for OTHER tabs, which is enough here: seeding happens
  // in the console and the page is reloaded after.
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

/**
 * The operator's hotkey bindings, keyed by `formatHotkey` output.
 *
 * Returns an empty map when nothing is seeded — which is the state every real
 * user is in, so the feature is inert in production until storage exists.
 */
export function useTAHotkeyBindings(): Record<string, number> {
  return useSyncExternalStore(subscribe, readBindings, () => EMPTY)
}
