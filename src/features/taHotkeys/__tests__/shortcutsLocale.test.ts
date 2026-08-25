/**
 * KAN-975 — every string the shortcuts screen asks for must exist in both
 * bundles.
 *
 * Every `t()` call on this screen passes an English default, which is what
 * makes a missing key invisible: the English reader sees the right words, the
 * Ukrainian reader sees English, and nothing fails. That is exactly how the
 * Remove button shipped pointing at `common.remove`, a key that was never
 * added to either bundle.
 *
 * A parity test would not have caught it — the key was missing from *both*
 * sides, so en and uk agreed perfectly.
 *
 * The keys are read out of the source rather than listed here, so a `t()` call
 * added later is covered without anyone remembering to update this file.
 */
import { describe, expect, it } from 'vitest'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
// Read as text, not imported as modules: this inspects what the source asks
// for, so it must not go through the component's own imports. `?raw` keeps it
// inside Vite's resolver rather than reaching for node's filesystem, which
// this tsconfig does not type.
import settingsSource from '../components/KeyboardShortcutsSettings.tsx?raw'
import recorderSource from '../components/ShortcutRecorderBox.tsx?raw'
import badgeSource from '../components/ShortcutBadge.tsx?raw'

const SOURCES = [settingsSource, recorderSource, badgeSource]

/** Literal keys passed to `t()`. Template literals and variables are skipped. */
function usedKeys(): string[] {
  const keys = new Set<string>()
  for (const src of SOURCES) {
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9._]+)'/g)) keys.add(m[1])
  }
  return [...keys].sort()
}

function lookup(bundle: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      bundle
    )
}

describe('shortcuts screen strings', () => {
  it('finds the keys it is meant to check', () => {
    // Guards the regex itself: if it silently matched nothing, the assertions
    // below would pass over an empty list and prove nothing.
    const keys = usedKeys()
    expect(keys.length).toBeGreaterThan(15)
    expect(keys).toContain('pages.profile.shortcuts.save')
  })

  it.each([
    ['en', enCommon],
    ['uk', ukCommon],
  ])('resolves every key in %s', (_locale, bundle) => {
    const missing = usedKeys().filter((key) => typeof lookup(bundle, key) !== 'string')
    expect(missing).toEqual([])
  })

  it.each([
    ['en', enCommon],
    ['uk', ukCommon],
  ])('has no blank values in %s', (_locale, bundle) => {
    const blank = usedKeys().filter((key) => String(lookup(bundle, key) ?? '').trim() === '')
    expect(blank).toEqual([])
  })
})
