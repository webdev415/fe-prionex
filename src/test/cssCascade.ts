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
 * component tests load. It does not rank rules inside ``@media``, ``@supports``
 * or ``@layer`` — evaluating a media query is outside what it models, and
 * ``@layer`` ordering overrides specificity outright, so no amount of parsing
 * would make the ranking right. Those rules are not dropped either: a skipped
 * rule that would have won is a mis-ranked cascade, so if one declares the
 * property asked for AND matches the element, this THROWS rather than hand
 * back the runner-up. Nested rules throw for the same reason. It does not
 * expand shorthands (ask for the longhand the stylesheet actually declares),
 * and ignores inline styles and inheritance. Reach for a real browser if any
 * of that starts to matter.
 */

/** Specificity triple: [id, class/attribute/pseudo-class, element]. */
export type Specificity = [number, number, number]

const compareSpecificity = (a: Specificity, b: Specificity): number =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/**
 * Split on a separator that appears outside parentheses, brackets and quotes.
 *
 * Brackets and quotes matter as much as parens here: a selector list holding
 * ``[data-x="a,b"]`` and a declaration value holding a quoted semicolon both
 * split in the wrong place without them, and the resulting garbage selector
 * fails to match rather than announcing itself.
 */
const splitTopLevel = (input: string, separator: string): string[] => {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let current = ''
  for (const ch of input) {
    if (quote) {
      current += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
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
   *
   * Every ``:hover`` in the selector is removed, not just a trailing one, so
   * ``.parent:hover .child`` resolves as ``.parent .child`` — i.e. as though
   * the CHILD were hovered. Every hover rule in the stylesheets these tests
   * load ends in ``:hover`` on the subject, so the approximation is exact
   * there; a descendant-of-hovered-ancestor rule would need a real browser.
   */
  hover?: boolean
}

interface RawRule {
  selector: string
  body: string
  order: number
  /** Enclosing at-rule prelude, when the rule was found inside one. */
  atRule?: string
}

interface ParseSink {
  /** Rules this resolver can rank. */
  rules: RawRule[]
  /** Rules found inside an at-rule block, kept so they can be reported. */
  deferred: RawRule[]
  counter: { n: number }
}

/**
 * Index of the quote that closes the one at ``start``, or the last index if the
 * string is unterminated. Backslash escapes are honoured.
 */
const closingQuote = (text: string, start: number): number => {
  const quote = text[start]
  for (let k = start + 1; k < text.length; k++) {
    if (text[k] === '\\') {
      k++
      continue
    }
    if (text[k] === quote) return k
  }
  return text.length - 1
}

/** Does the body hold a ``{`` that is real structure rather than string data? */
const hasNestedBlock = (body: string): boolean => {
  for (let k = 0; k < body.length; k++) {
    const ch = body[k]
    if (ch === '"' || ch === "'") {
      k = closingQuote(body, k)
      continue
    }
    if (ch === '{') return true
  }
  return false
}

/**
 * Strip comments, then collect top-level ``selector { body }`` pairs.
 *
 * Rules inside an at-rule block go to ``deferred`` rather than being thrown
 * away, so ``winningDeclaration`` can tell whether one of them would have
 * changed the answer instead of silently returning the runner-up. ``atRule``
 * carries the enclosing prelude down so the report can name it.
 */
const parseRules = (css: string, sink: ParseSink, atRule?: string): void => {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let prelude = ''
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    // A quoted string is data, not structure. Stepping over it whole keeps a
    // ``{``, ``}`` or ``;`` inside one — ``content: "{"`` is legal CSS — from
    // being counted as a brace or a statement end, which would mis-slice every
    // rule after it.
    if (ch === '"' || ch === "'") {
      const close = closingQuote(text, i)
      prelude += text.slice(i, close + 1)
      i = close + 1
      continue
    }

    // A statement at-rule (``@charset "UTF-8";``, ``@import …;``, ``@layer a,
    // b;``) ends at a semicolon and owns no block. Without this reset its text
    // stays in the prelude and is glued onto the NEXT selector, which then
    // starts with ``@`` and is dropped — react-datepicker.css opens with
    // ``@charset`` and lost its entire first rule that way.
    if (ch === ';') {
      prelude = ''
      i++
      continue
    }

    if (ch !== '{') {
      prelude += ch
      i++
      continue
    }

    let depth = 1
    let j = i + 1
    while (j < text.length && depth > 0) {
      const c = text[j]
      if (c === '"' || c === "'") {
        j = closingQuote(text, j) + 1
        continue
      }
      if (c === '{') depth++
      else if (c === '}') depth--
      j++
    }

    const selector = prelude.trim()
    const body = text.slice(i + 1, j - 1)

    if (selector.startsWith('@')) {
      // Descend so the rules inside are known, but keep them out of the
      // ranking: @media needs its query evaluated and @layer overrides
      // specificity outright, neither of which this resolver models.
      parseRules(body, sink, atRule ? `${atRule} > ${selector}` : selector)
    } else if (selector) {
      if (hasNestedBlock(body)) {
        throw new Error(
          `cssCascade: the rule ${JSON.stringify(selector.slice(0, 80))} contains a nested ` +
            `block. Nesting is not parsed, and the inner rules would be mis-attributed to ` +
            `the outer selector. Flatten the rule or resolve it in a real browser.`
        )
      }
      const rule: RawRule = { selector, body, order: sink.counter.n++, atRule }
      ;(atRule ? sink.deferred : sink.rules).push(rule)
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

const loadedRules = (): ParseSink => {
  const sink: ParseSink = { rules: [], deferred: [], counter: { n: 0 } }

  for (const sheet of Array.from(document.styleSheets)) {
    const raw = (sheet.ownerNode as HTMLStyleElement | null)?.textContent
    if (raw) {
      parseRules(raw, sink)
      continue
    }
    // No inline source (e.g. a constructed sheet): fall back to the CSSOM and
    // accept that ``!important`` on a ``var()`` value is lost.
    try {
      parseRules(
        Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n'),
        sink
      )
    } catch {
      // Unreadable cross-origin sheet — genuinely inaccessible, not a swallowed
      // bug. Its rules cannot affect a jsdom test either way.
      continue
    }
  }

  return sink
}

/**
 * Throw if a rule this resolver refused to rank would have been a candidate.
 *
 * An at-rule that declares the property AND matches the element could change
 * the winner, so returning the runner-up as though it were the answer is the
 * confidently-wrong result this helper exists to prevent. Silence is only safe
 * when none of the deferred rules could have competed.
 */
const assertNoDeferredCandidate = (
  deferred: RawRule[],
  el: Element,
  prop: string,
  hover: boolean
): void => {
  for (const rule of deferred) {
    if (!parseDeclaration(rule.body, prop)) continue

    for (const rawSelector of splitTopLevel(rule.selector, ',')) {
      const selector = rawSelector.trim().replace(/\s+/g, ' ')
      if (!selector) continue
      const isHoverSelector = selector.includes(':hover')
      if (isHoverSelector && !hover) continue

      let applies = false
      try {
        applies = el.matches(isHoverSelector ? selector.replace(/:hover/g, '') : selector)
      } catch {
        // Unmatchable here means it cannot be shown to compete; the loud throw
        // for that case belongs to the ranking path below.
        continue
      }
      if (!applies) continue

      throw new Error(
        `cssCascade: ${JSON.stringify(selector)} declares ${JSON.stringify(prop)} and matches ` +
          `this element, but sits inside ${JSON.stringify(rule.atRule ?? 'an at-rule')}, whose ` +
          `condition this resolver does not evaluate. The ranking would omit it and report ` +
          `the runner-up as the winner. If that block cannot apply here (a print or ` +
          `feature query, say), assert a property it does not set; otherwise use a real ` +
          `browser or flatten the rule.`
      )
    }
  }
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

  const { rules, deferred } = loadedRules()
  assertNoDeferredCandidate(deferred, el, prop, hover)

  for (const rule of rules) {
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
