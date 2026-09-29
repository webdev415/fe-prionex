/**
 * Colour guard of the planner section (planner story 5.1, AC1; DESIGN.md
 * «Colors», UX-DR50).
 *
 * 1. The section's source has no hex colour and no `dark:` variant: `dark:`
 *    follows the OS, not `data-theme`, and a hex breaks three of the four
 *    theme bases.
 * 2. Every role pair of `plannerTones` holds its contrast in all four bases
 *    (`light-classic`, `high-contrast-light`, `neutral-dim`, `ultra-dark`,
 *    accent `teal`): text of a pill ≥ 4.5 on its own background, a status dot
 *    and the coloured priority icon ≥ 3 against the card. jsdom resolves no CSS
 *    variables, so the test resolves them itself from `index.css` (`@theme`,
 *    the defaults) and `themes.css` (unlayered, so it always wins over
 *    `@theme`), by the same specificity-then-order rule a browser applies.
 */
import { describe, expect, it } from 'vitest'
import indexCss from '@/index.css?raw'
import themesCss from '@/theme/themes.css?raw'
import { CATEGORY_DOT, PLANNER_TONES, PRIORITY_TOP_INK } from '../plannerTones'

const SOURCES = import.meta.glob(['../**/*.{ts,tsx}', '!../**/__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const BASES = ['light-classic', 'high-contrast-light', 'neutral-dim', 'ultra-dark'] as const
type Base = (typeof BASES)[number]
const ACCENT = 'teal'

type Declarations = Map<string, string>

function declarations(body: string): Declarations {
  const out: Declarations = new Map()
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    out.set(match[1], match[2].trim())
  return out
}

/** Specificity of a root selector this guard understands, or null if it does not match. */
function rootSelectorSpecificity(selector: string, base: Base): number | null {
  const s = selector.trim()
  const head = s.match(/^(html|:root)/)
  if (!head) return null
  const attrs = [...s.slice(head[0].length).matchAll(/\[([\w-]+)(?:='([^']*)')?\]/g)]
  const rest = s.slice(head[0].length).replace(/\[[^\]]*\]/g, '')
  if (rest.trim() !== '') return null // a descendant selector, not the root
  const actual: Record<string, string> = { 'data-theme': base, 'data-accent': ACCENT }
  for (const [, name, value] of attrs) {
    if (!(name in actual)) return null
    if (value !== undefined && actual[name] !== value) return null
  }
  // (0, classes+attributes+pseudo, elements) folded into one number.
  return (attrs.length + (head[1] === ':root' ? 1 : 0)) * 100 + (head[1] === 'html' ? 1 : 0)
}

function themeVariables(base: Base): Declarations {
  const vars: Declarations = new Map()
  const theme = indexCss.match(/@theme\s*{([\s\S]*?)\n}/)
  expect(theme, '@theme block of index.css').not.toBeNull()
  for (const [name, value] of declarations(theme![1])) vars.set(name, value)

  const rules: { specificity: number; order: number; decls: Declarations }[] = []
  let order = 0
  for (const rule of themesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = rule[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',')
    const hits = selectors
      .map((selector) => rootSelectorSpecificity(selector, base))
      .filter((n): n is number => n !== null)
    if (hits.length > 0)
      rules.push({ specificity: Math.max(...hits), order: order++, decls: declarations(rule[2]) })
  }
  rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order)
  for (const rule of rules) for (const [name, value] of rule.decls) vars.set(name, value)
  return vars
}

function resolve(vars: Declarations, name: string, depth = 0): string {
  const value = vars.get(name)
  if (value === undefined) throw new Error(`${name} is not defined`)
  const ref = value.match(/^var\((--[\w-]+)\)$/)
  if (ref && depth < 10) return resolve(vars, ref[1], depth + 1)
  return value
}

function rgb(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) throw new Error(`not an opaque hex colour: ${hex}`)
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `text-error-700` / `bg-error-50` → the colour it paints in this base. */
const paint = (vars: Declarations, utility: string) =>
  resolve(vars, `--color-${utility.replace(/^(text|bg)-/, '')}`)

describe('planner colours — theme variables only (5.1 AC1)', () => {
  it('the section source has no hex colour and no `dark:` variant', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(10)
    const offenders = Object.entries(SOURCES).flatMap(([path, source]) => [
      ...[...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => `${path}: ${m[0]}`),
      ...[...source.matchAll(/\bdark:/g)].map(() => `${path}: dark:`),
    ])
    expect(offenders).toEqual([])
  })

  it('reads the real stylesheets', () => {
    expect(indexCss.length).toBeGreaterThan(1000)
    expect(themesCss).toContain("html[data-theme='neutral-dim']")
  })

  it.each(BASES)('pill text holds ≥ 4.5:1 on its background in %s', (base) => {
    const vars = themeVariables(base)
    const ratios = Object.entries(PLANNER_TONES).map(
      ([tone, { ink, bg }]) => [tone, contrast(paint(vars, ink), paint(vars, bg))] as const
    )
    for (const [tone, ratio] of ratios) expect(ratio, `${base} ${tone}`).toBeGreaterThanOrEqual(4.5)
  })

  it.each(BASES)('status dots and the top priority icon hold ≥ 3:1 on the card in %s', (base) => {
    const vars = themeVariables(base)
    const card = resolve(vars, '--card')
    for (const [category, dot] of Object.entries(CATEGORY_DOT)) {
      expect(contrast(paint(vars, dot), card), `${base} ${category}`).toBeGreaterThanOrEqual(3)
    }
    expect(
      contrast(paint(vars, PRIORITY_TOP_INK), card),
      `${base} priority`
    ).toBeGreaterThanOrEqual(3)
  })

  it('the guard itself follows the theme: neutral-dim remaps the overdue ink', () => {
    expect(paint(themeVariables('light-classic'), PLANNER_TONES.overdue.ink)).toBe('#b91c1c')
    expect(paint(themeVariables('neutral-dim'), PLANNER_TONES.overdue.ink)).not.toBe('#b91c1c')
  })
})
