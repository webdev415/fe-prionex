import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/common.json'
import uk from '@/../public/locales/uk/common.json'
import { FEED_ERROR_KEY_PREFIXES } from '../useFeedErrorMessage'

/**
 * The gate `useFeedErrorMessage` owes the project.
 *
 * The hook builds its keys by concatenation — `t(`${prefix}.unavailable`)` —
 * and a concatenated key is invisible to every static scanner we have;
 * `pages/Credit/__tests__/i18nKeys.test.ts` skips template keys on purpose,
 * because it cannot know their values. Before the extraction each of those 48
 * keys was a literal inside a tab, greppable and reviewable. The extraction is
 * what opens the hole, so it brings the gate: a missing key or a misspelled
 * prefix now fails a test instead of putting `pages.reports.promisesFeeed.
 * unavailable` on an operator's screen. That failure mode is not hypothetical
 * — the Credit section's gate exists because it shipped twice and was found by
 * eye on a live screen both times.
 *
 * `error.retry` is here although no tab asks for it through the hook: the
 * twelve tabs still write it as a literal in their retry button, it belongs to
 * the same four-key error block, and a section that lost it would render a
 * button labelled with its own key. Checking it costs one array entry.
 */
const SUFFIXES = ['unavailable', 'forbidden', 'error.title', 'error.retry'] as const

/**
 * KNOWN LIMIT, stated rather than implied: the glob covers
 * `features/<feature>/components/<Name>Tab.tsx` only — spelled without the
 * glob star here, because a star followed by a slash would end this
 * comment. A report tab living
 * elsewhere (say
 * under `pages/ReportsDashboard/components/`) would register its prefix and
 * stay invisible to the caller count. The same class of limit the window-cap
 * gate records in its own docstring.
 *
 * Tab sources, read through Vite's glob rather than `node:fs`: the project
 * builds without Node types, so `tsc -b` (and therefore CI) fails on importing
 * `node:fs` — the same reason the Credit gate reads its sources this way.
 */
const TAB_SOURCES = import.meta.glob('../../features/*/components/*Tab.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const HOOK_CALLERS = Object.entries(TAB_SOURCES)
  .filter(([, source]) => /\buseFeedErrorMessage\s*\(/.test(source))
  .map(([path]) => path)
  .sort()

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

describe('feed error keys', () => {
  it('exist in BOTH dictionaries for every registered prefix', () => {
    // Both, not either: a key present only in `uk` renders as its own name for
    // an operator who switched to English, which is the very defect this
    // guards. Reported as one list so a missing section shows up as four lines
    // rather than four reruns.
    const missing: string[] = []
    for (const prefix of Object.values(FEED_ERROR_KEY_PREFIXES)) {
      for (const suffix of SUFFIXES) {
        const key = `${prefix}.${suffix}`
        if (typeof lookup(en, key) !== 'string') missing.push(`en: ${key}`)
        if (typeof lookup(uk, key) !== 'string') missing.push(`uk: ${key}`)
      }
    }
    expect(missing, `feed error keys missing from a dictionary:\n${missing.join('\n')}`).toEqual([])
  })

  it('sees the report tabs at all', () => {
    // Anti-vacuum, and the lesson of the previous gate in this task: an
    // assertion over an empty glob passes and reads as proof. A renamed
    // features/ layout would empty this silently. The threshold is deliberately
    // far below the truth (the glob sees 12 files today): it is here to catch a
    // glob that broke, not to restate how many report tabs exist — pinning that
    // would make deleting a tab a test failure in an unrelated file.
    const paths = Object.keys(TAB_SOURCES)
    expect(paths.length).toBeGreaterThan(5)
    expect(paths.some((path) => path.endsWith('/CallbacksFeedTab.tsx'))).toBe(true)
  })

  it('covers every tab that actually calls the hook', () => {
    // The registry must not be SHORTER than the list of callers. A missing
    // prefix cannot compile (the parameter type is the union of the registry's
    // values), so the case this guards is a caller passing a LITERAL that
    // happens to equal a registered value — which the next test catches by
    // spelling, and this one by count when the literal belongs to another
    // tab. Not an equality: a registered prefix with no caller yet (a tab in
    // progress) is not a defect.
    expect(HOOK_CALLERS.length).toBeGreaterThan(0)
    expect(
      Object.keys(FEED_ERROR_KEY_PREFIXES).length,
      `tabs calling useFeedErrorMessage:\n${HOOK_CALLERS.join('\n')}`
    ).toBeGreaterThanOrEqual(HOOK_CALLERS.length)
  })

  it('is what the callers actually pass — no prefix written as a literal', () => {
    // The parameter type is the union of the registry's VALUES, so a literal
    // `'pages.reports.contactTag'` at a call site type-checks happily and
    // silently opts out of the registry — including out of the count above.
    // The rule is "name it from the registry", and this is what enforces it.
    // At the CALL SITE, not anywhere in the file: a tab with two calls — one
    // from the registry, one a literal — or a file that only mentions the
    // registry in a comment would pass a whole-file `includes`.
    const offenders = HOOK_CALLERS.filter((path) => {
      const calls = TAB_SOURCES[path].match(/useFeedErrorMessage\(/g) ?? []
      const fromRegistry =
        TAB_SOURCES[path].match(/useFeedErrorMessage\(\s*[^,]+,\s*FEED_ERROR_KEY_PREFIXES\./g) ?? []
      return calls.length === 0 || fromRegistry.length !== calls.length
    })
    expect(
      offenders,
      `these tabs pass a feed error prefix without naming it in the registry:\n${offenders.join('\n')}`
    ).toEqual([])
  })
})
