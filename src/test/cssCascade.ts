/**
 * A cascade resolver for jsdom tests.
 *
 * jsdom's own ``getComputedStyle`` does not implement specificity: it applies
 * the LAST matching rule in source order and stops there. That is fine when a
 * single rule matches an element, and actively misleading when two do — a
 * (0,3,0) rule declared above a (0,2,0) rule loses in jsdom and wins in every
 * real browser. A whole class of stylesheet regression is therefore invisible
 * to a ``getComputedStyle`` assertion, including KAN-992's: adding a guard to
 * a selector raised its specificity past a later rule it had previously only
 * tied, silently stealing that rule's declarations.
 *
 * ``winningDeclaration`` walks the loaded stylesheets, keeps every declaration
 * of ``property`` whose selector matches ``el``, and sorts them the way the
 * cascade does — ``!important`` first, then specificity, then source order —
 * so a test can assert WHICH RULE WINS rather than what jsdom happens to
 * compute. Verified against Chrome for the selectors it is used on.
 *
 * Rules are read from the raw text of each ``<style>`` node rather than from
 * the CSSOM, because jsdom's declaration parser DROPS the ``!important`` flag
 * whenever the value is a ``var()`` reference — it does not understand custom
 * properties, so ``color: var(--foreground) !important`` comes back with an
 * empty priority. Ranking off that would put every themed declaration below
 * react-datepicker's own defaults, which are plain values on very long
 * selectors, and the resolver would confidently report the library's #216ba5
 * where the product paints its accent.
 *
 * Scope, deliberately: this covers the flat, single-document stylesheets these
 * component tests load. It does not descend into ``@media``/``@supports``
 * (those rules are skipped, not mis-ranked), does not expand shorthands (ask
 * for the longhand the stylesheet actually declares), and ignores inline
 * styles, ``@layer`` and inheritance. Reach for a real browser if any of that
 * starts to matter.
 */

/** Specificity triple: [id, class/attribute/pseudo-class, element]. */
export type Specificity = [number, number, number]

const compareSpecificity = (a: Specificity, b: Specificity): number =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** Split on a separator that appears outside any parentheses. */
const splitTopLevel = (input: string, separator: string): string[] => {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of input) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === separator && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
}

const IDENT = /[\w-]/

/**
 * Specificity per CSS Selectors 4. ``:is()``/``:not()``/``:has()`` take the
 * specificity of their most specific argument; ``:where()`` contributes
 * nothing; any other functional pseudo-class counts as one class.
 */
export const specificityOf = (selector: string): Specificity => {
  let ids = 0
  let classes = 0
  let elements = 0
  let i = 0
  const s = selector.trim()

  const readIdent = () => {
    while (i < s.length && IDENT.test(s[i])) i++
  }

  while (i < s.length) {
    const ch = s[i]

    if (ch === '#') {
      ids++
      i++
      readIdent()
    } else if (ch === '.') {
      classes++
      i++
      readIdent()
    } else if (ch === '[') {
      classes++
      while (i < s.length && s[i] !== ']') i++
      i++
    } else if (ch === ':') {
      if (s[i + 1] === ':') {
        // Pseudo-element — counts as an element.
        elements++
        i += 2
        readIdent()
        continue
      }
      i++
      const start = i
      readIdent()
      const name = s.slice(start, i)

      if (s[i] !== '(') {
        classes++
        continue
      }

      // Capture the balanced argument list.
      let depth = 0
      const argStart = i + 1
      while (i < s.length) {
        if (s[i] === '(') depth++
        else if (s[i] === ')') {
          depth--
          if (depth === 0) break
        }
        i++
      }
      const args = s.slice(argStart, i)
      i++ // past ')'

      if (name === 'where') continue

      if (name === 'not' || name === 'is' || name === 'matches' || name === 'has') {
        const most = splitTopLevel(args, ',')
          .map((arg) => specificityOf(arg))
          .reduce<Specificity>(
            (best, cur) => (compareSpecificity(cur, best) > 0 ? cur : best),
            [0, 0, 0]
          )
        ids += most[0]
        classes += most[1]
        elements += most[2]
      } else {
        classes++
      }
    } else if (IDENT.test(ch)) {
      elements++
      readIdent()
    } else {
      // Combinators, whitespace, ``*`` — no contribution.
      i++
    }
  }

  return [ids, classes, elements]
}

export interface MatchedDeclaration {
  selector: string
  value: string
  important: boolean
}

interface Options {
  /**
   * Resolve as though the pointer were over the element. jsdom has no pointer,
   * so a ``:hover`` selector never matches there; hover selectors are matched
   * with the ``:hover`` removed, while their specificity is still computed
   * from the full selector.
   */
  hover?: boolean
}

interface RawRule {
  selector: string
  body: string
  order: number
}

/** Strip comments, then collect top-level ``selector { body }`` pairs. */
const parseRules = (css: string, into: RawRule[], counter: { n: number }): void => {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let prelude = ''
  let i = 0

  while (i < text.length) {
    if (text[i] !== '{') {
      prelude += text[i]
      i++
      continue
    }

    let depth = 1
    let j = i + 1
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++
      else if (text[j] === '}') depth--
      j++
    }

    const selector = prelude.trim()
    // At-rules are skipped whole — see the scope note above.
    if (selector && !selector.startsWith('@')) {
      into.push({ selector, body: text.slice(i + 1, j - 1), order: counter.n++ })
    }
    prelude = ''
    i = j
  }
}

const parseDeclaration = (body: string, property: string) => {
  let found: { value: string; important: boolean } | null = null

  for (const part of splitTopLevel(body, ';')) {
    const colon = part.indexOf(':')
    if (colon === -1) continue
    if (part.slice(0, colon).trim().toLowerCase() !== property) continue

    let value = part.slice(colon + 1).trim()
    const important = /!\s*important$/i.test(value)
    if (important) value = value.replace(/!\s*important$/i, '').trim()
    // A later declaration in the same block overrides an earlier one.
    found = { value, important }
  }

  return found
}

const loadedRules = (): RawRule[] => {
  const rules: RawRule[] = []
  const counter = { n: 0 }

  for (const sheet of Array.from(document.styleSheets)) {
    const raw = (sheet.ownerNode as HTMLStyleElement | null)?.textContent
    if (raw) {
      parseRules(raw, rules, counter)
      continue
    }
    // No inline source (e.g. a constructed sheet): fall back to the CSSOM and
    // accept that ``!important`` on a ``var()`` value is lost.
    try {
      parseRules(
        Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n'),
        rules,
        counter
      )
    } catch {
      // Unreadable cross-origin sheet — genuinely inaccessible, not a swallowed
      // bug. Its rules cannot affect a jsdom test either way.
      continue
    }
  }

  return rules
}

/**
 * The declaration of ``property`` that would win on ``el`` in a real browser,
 * or ``null`` if no loaded rule sets it.
 */
export const winningDeclaration = (
  el: Element,
  property: string,
  { hover = false }: Options = {}
): MatchedDeclaration | null => {
  const prop = property.toLowerCase()
  const matches: (MatchedDeclaration & { specificity: Specificity; order: number })[] = []

  for (const rule of loadedRules()) {
    const declaration = parseDeclaration(rule.body, prop)
    if (!declaration) continue

    for (const rawSelector of splitTopLevel(rule.selector, ',')) {
      const selector = rawSelector.trim().replace(/\s+/g, ' ')
      if (!selector) continue

      const isHoverSelector = selector.includes(':hover')
      if (isHoverSelector && !hover) continue

      const matchable = isHoverSelector ? selector.replace(/:hover/g, '') : selector
      let applies = false
      try {
        applies = el.matches(matchable)
      } catch (error) {
        // Deliberately loud. Swallowing this would drop a candidate from the
        // cascade and quietly hand back the runner-up rule — the exact class
        // of wrong-but-green answer this helper exists to prevent. No selector
        // in the stylesheets these tests load hits it today (all 299 parse),
        // so a throw here means a stylesheet or jsdom upgrade introduced
        // syntax the selector engine rejects, and the ranking below it can no
        // longer be trusted.
        throw new Error(
          `cssCascade: jsdom cannot match the selector ${JSON.stringify(matchable)}. ` +
            `Ranking would silently omit it. Original error: ${(error as Error).message}`
        )
      }
      if (!applies) continue

      matches.push({
        selector,
        value: declaration.value,
        important: declaration.important,
        specificity: specificityOf(selector),
        order: rule.order,
      })
    }
  }

  if (matches.length === 0) return null

  matches.sort(
    (a, b) =>
      Number(a.important) - Number(b.important) ||
      compareSpecificity(a.specificity, b.specificity) ||
      a.order - b.order
  )

  const winner = matches[matches.length - 1]
  return { selector: winner.selector, value: winner.value, important: winner.important }
}
