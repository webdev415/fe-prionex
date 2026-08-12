/**
 * The operator's hotkey bindings.
 *
 * Replaces the localStorage stand-in this feature shipped behind while the
 * storage question was open: bindings now live in the client service, keyed by
 * the operator, so they follow the operator between machines and browsers.
 *
 * Read-only for now. The write side (assign / clear) belongs to the Profile
 * Settings tab in KAN-975 and lands with it — adding the mutations here ahead
 * of a caller would ship three untested exports nobody runs.
 */
import { useQuery } from '@tanstack/react-query'
import { getTAHotkeys } from '../api/taHotkeysApi'
import type { TAHotkeyBinding } from '../api/types'

const KEY = ['ta-hotkeys'] as const

/** Referentially stable, so a loading page does not churn its consumers. */
const EMPTY: Record<string, number> = {}

/**
 * Module-scoped so react-query can memoize the transform against the fetched
 * data. Declared inline it would be a new function each render, and the map
 * would be rebuilt on every one.
 */
function toBindingMap(bindings: TAHotkeyBinding[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const binding of bindings) {
    map[binding.hotkey] = binding.quick_pick_id
  }
  return map
}

/**
 * The operator's bindings as `formatHotkey output -> quick pick id`.
 *
 * A map rather than the raw list because the client card's only question is
 * "what is bound to the combination just pressed?", asked on every keystroke
 * that reaches the page.
 *
 * Returns an empty map while loading, which reads as "nothing is bound" — the
 * same thing an unassigned key does, so an early keypress does nothing rather
 * than opening the wrong template.
 */
export function useTAHotkeyBindings(): Record<string, number> {
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: getTAHotkeys,
    select: toBindingMap,
    // Bindings change only when this operator edits them, which no UI can do
    // yet. Without this the client card refetches the map on every tab focus,
    // which for a page operators leave and return to all day is a request per
    // glance. KAN-975 invalidates ['ta-hotkeys'] when it adds the write side.
    staleTime: 5 * 60 * 1000,
  })
  return data ?? EMPTY
}
