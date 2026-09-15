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
    // Keys are relative to THIS file, so the module itself arrives as exactly
    // `../reportWindow.ts`; `import.meta.glob` already leaves this suite out.
    // The EXACT key, not a name suffix: with the path regex below accepting
    // `./reportWindow` from anywhere, a suffix filter would also drop a COPY
    // of the module planted next to a feature — and its `./` consumers would
    // then read as legitimate. Verified by planting exactly that: a suffix
    // filter passed 10/10, this one goes red.
  ).filter(([path]) => path !== '../reportWindow.ts')
)

/**
 * Every spelling of an import FROM THIS MODULE, in one place.
 *
 * Both halves matter. The PATH half accepts the `@/` alias and every relative
 * form, `lib/` segment or not: a file inside `src/lib` reaches its neighbour as
 * `'./reportWindow'` (three files there already import a sibling that way), and
 * a path-only pattern would read that legitimate import as a violation. A gate
 * whose red is sometimes wrong stops being read, and being read is all it has.
 *
 * The SPECIFIER half captures either a brace list or a namespace import. A
 * namespace import (`import * as rw from …`) brings in every export, so
 * `rw.MAX_RANGE_DAYS` in the body is a legitimate use of the name — matched by
 * the mention regex and, without this branch, reported as a file that names the
 * constant without importing it. Nobody writes that form here today; the point
 * is that the gate must not punish them for starting.
 *
 * `g` is not decoration: `String.match` without it returns the FIRST match
 * only, so a file that writes `import type { … }` on one line and
 * `import { … }` on the next would have half its specifiers invisible.
 */
const MODULE_IMPORT =
  /import\s+(?:type\s+)?(?:\{([^}]*)\}|\*\s+as\s+\w+)\s+from\s+'(?:@\/lib\/reportWindow|(?:\.{1,2}\/)+(?:lib\/)?reportWindow)'/g

/**
 * Does this file import `name` FROM THIS MODULE? Parses the specifier lists —
 * ALL of them — rather than testing for the path, so "imports the module"
 * cannot stand in for "imports this symbol". A renaming import (`as`) counts
 * under its original name, and an inline `type` specifier under its bare one:
 * the declaration being policed is the export, not how a call site spells it.
 */
function importsSymbol(source: string, name: string): boolean {
  for (const statement of source.matchAll(MODULE_IMPORT)) {
    const specifiers = statement[1]
    // A namespace import has no specifier list and brings in everything.
    if (specifiers === undefined) return true
    const imported = specifiers.split(',').some(
      (entry) =>
        entry
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim() === name
    )
    if (imported) return true
  }
  return false
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
    // The glob saw 2067 files when this line was written; the threshold is
    // deliberately far below that and is NOT to be raised to match. It exists
    // to catch a glob that returned nothing (or lost a directory), not to
    // record how big the repository is — a threshold tracking the real count
    // turns any large deletion into a failure in an unrelated file.
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
