import { describe, expect, it } from 'vitest'
import { MAX_RANGE_DAYS, isWindowTooLong } from '../reportWindow'

/**
 * The union of the two suites this replaces — `promisesFeed/utils/__tests__/
 * window.test.ts` and its near-identical callbacks twin (they differed in the
 * describe name, one comment block, one same-day date and one extra case) — so
 * nothing that was pinned before is pinned less now. Both files are deleted
 * with this change; the case only the callbacks copy held (the
 * forward-looking window) is kept below.
 *
 * The 366/367 boundary stays pinned at the CALL SITES too, through the UI, in
 * the six tabs' own suites — those were not touched by this change, which is
 * what proves the extraction changed no behaviour.
 */
describe('report window guard', () => {
  it('pins the mirrored backend cap at a 366-day difference', () => {
    // The constant IS the contract (reports.py: end - start <= 366) — a
    // "tidy-up" to 365 must be a conscious decision, not a refactor slip.
    expect(MAX_RANGE_DAYS).toBe(366)
  })

  it('lets the widest allowed window — exactly a 366-day difference — through', () => {
    // 2026-01-01 → 2027-01-02 differ by 366 days (367 inclusive): the last
    // window the backend still answers. Pinning the boundary from the allowed
    // side too, or the guard could silently tighten.
    expect(isWindowTooLong('2026-01-01', '2027-01-02')).toBe(false)
  })

  it('refuses a 367-day difference', () => {
    expect(isWindowTooLong('2026-01-01', '2027-01-03')).toBe(true)
  })

  it('treats a same-day window as trivially fine', () => {
    // Several tabs DEFAULT to today–today, so this path runs on every mount.
    expect(isWindowTooLong('2026-09-08', '2026-09-08')).toBe(false)
  })

  it('accepts a window pointing into the FUTURE — a call plan legitimately does', () => {
    // Unlike the backward-looking feeds, the callbacks plan holds scheduled
    // calls for the coming weeks; a forward window must not be special-cased
    // into "too long".
    expect(isWindowTooLong('2026-09-09', '2026-10-09')).toBe(false)
  })

  it('crosses a leap February without drifting a day', () => {
    // 2028 is a leap year: 2027-03-01 → 2028-03-01 is exactly a 366-day
    // difference (the leap day is inside), so it is still allowed — while the
    // same pair over a common year (365 days) obviously is too. Date.parse
    // reads both bounds as UTC midnights, so the difference is exact whatever
    // the host timezone is.
    expect(isWindowTooLong('2027-03-01', '2028-03-01')).toBe(false)
    expect(isWindowTooLong('2027-03-01', '2028-03-02')).toBe(true)
  })

  it('does not report an inverted pair as too long — that is the inversion guard’s finding', () => {
    expect(isWindowTooLong('2027-01-01', '2026-01-01')).toBe(false)
  })
})

/**
 * The mechanical gate, and the actual point of this change.
 *
 * Moving the constant once fixes today's six copies; it does not stop the
 * seventh. A tab author who needs the cap and does not know this module exists
 * will write `const MAX_RANGE_DAYS = 366` locally — that is exactly how the six
 * came to be, one reasonable decision at a time — and nothing would go red. So
 * the rule is enforced by a test rather than by review attention.
 *
 * THE RULE IS "NAME IT ONLY IF YOU IMPORT THAT NAME", and the second half
 * matters as much as the first. Matching declaration syntax (`const X = `)
 * would be worked around by accident within a month — a type annotation, a
 * destructured constant, an arrow function each slip past a pattern written
 * for the previous shape. Checking merely that the file imports this module
 * would miss the likeliest divergence of all: importing `isWindowTooLong` and
 * declaring a local `MAX_RANGE_DAYS = 400` next to it when the server contract
 * moves. So each symbol is checked against the import's own specifier list.
 *
 * WHAT THIS DOES NOT CATCH, stated plainly rather than implied: the same rule
 * written with no names at all — an inline `(Date.parse(to) - Date.parse(from))
 * / 86_400_000 > 366`. A literal-366 sweep would be worse than useless here,
 * because a dozen legitimate docstrings across the feeds explain the cap (or
 * explain that their endpoint has none) and would all go red. The gate closes
 * the named form that produced today's six copies; the anonymous form stays a
 * review question.
 *
 * Scanning `__tests__` too is deliberate, unlike `pages/Credit/__tests__/
 * i18nKeys.test.ts` which skips them: a test that hardcodes the cap is the
 * same divergence with the same consequence. A comment that names the export
 * without importing it therefore goes red as well — the fix is to say
 * `@/lib/reportWindow`'s cap, or to import it. Note that the BACKEND's name
 * `_MAX_RANGE_DAYS` does not trip the check (the leading underscore is a word
 * character, so the boundary does not match), which is why the tabs' existing
 * comments about it stay green.
 */
const SCANNED_SOURCES = Object.fromEntries(
  Object.entries(
    // The whole tree, not just features/ and pages/: shared window fields would
    // naturally land in components/ or hooks/, and a copy there is the same
    // divergence. The module and this suite are the two legitimate homes.
    import.meta.glob('../../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    // Keys are relative to THIS file, so the module itself arrives as
    // `../reportWindow.ts`; `import.meta.glob` already leaves this suite out.
  ).filter(([path]) => !path.endsWith('/reportWindow.ts'))
)

/**
 * Does this file import `name` FROM THIS MODULE? Parses the specifier list
 * rather than testing for the path, so "imports the module" cannot stand in
 * for "imports this symbol". A renaming import (`as`) counts under its
 * original name — the declaration being policed is the export, not the alias.
 * Relative spellings are accepted alongside the `@/` alias: none exist today
 * (1062 `@/lib/...` imports under features/ and pages/, zero relative), but a
 * legitimate import must never read as a violation.
 */
function importsSymbol(source: string, name: string): boolean {
  const specifiers = source.match(
    /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'(?:@\/|(?:\.\.\/)+)lib\/reportWindow'/
  )
  return (specifiers?.[1] ?? '')
    .split(',')
    .some((entry) => entry.trim().split(/\s+as\s+/)[0] === name)
}

function filesNaming(name: string, mention: RegExp): string[] {
  return Object.entries(SCANNED_SOURCES)
    .filter(([, source]) => mention.test(source) && !importsSymbol(source, name))
    .map(([path]) => path)
    .sort()
}

describe('the window cap has exactly one definition', () => {
  it('sees the whole source tree, both halves of it', () => {
    // Without this the assertions below would pass on an empty glob — a gate
    // that cannot fail is worse than no gate, because it reads as proof. The
    // count alone is not enough: a glob that silently lost one directory would
    // still be in the hundreds, so both halves are named explicitly.
    const paths = Object.keys(SCANNED_SOURCES)
    expect(paths.length).toBeGreaterThan(1500)
    expect(paths.some((path) => path.includes('/features/'))).toBe(true)
    expect(paths.some((path) => path.includes('/pages/'))).toBe(true)
  })

  it('is never named without importing it', () => {
    const offenders = filesNaming('MAX_RANGE_DAYS', /\bMAX_RANGE_DAYS\b/)
    expect(
      offenders,
      `MAX_RANGE_DAYS is named without importing it from @/lib/reportWindow:\n${offenders.join('\n')}`
    ).toEqual([])
  })

  it('is never re-implemented', () => {
    const offenders = filesNaming('isWindowTooLong', /\bisWindowTooLong\b/)
    expect(
      offenders,
      `isWindowTooLong is named without importing it from @/lib/reportWindow:\n${offenders.join('\n')}`
    ).toEqual([])
  })
})
