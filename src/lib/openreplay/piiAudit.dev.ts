/**
 * `window.__piiAudit()` — the runtime half of the KAN-KB-54 barrier.
 *
 * WHAT IT IS FOR. Reviewing a session recording frame by frame answers "did I
 * see personal data in the clear?" It cannot answer "what did I miss", because
 * the eye does not see what never entered the frame. This walks the DOM that is
 * on screen right now, looks for the values the API actually returned, and
 * NAMES every node that has no `[data-openreplay-obscured]` ancestor. The output
 * is a list, not a reassurance.
 *
 * WHAT IT IS NOT. It sees the current DOM, so it cannot know about a screen that
 * has not been opened. `scripts/pii-audit.mjs` is the other half: that one reads
 * the SOURCE and catches a new render site the moment it is committed, while
 * this one catches new MARKUP — a portal, a wrapper, a block moved out of a
 * marked container. Neither substitutes for the other.
 *
 * 🔴 DEV ONLY, and structurally so. The whole module is behind a dynamic
 * `import()` guarded by `import.meta.env.DEV`, which Vite resolves to `false` in
 * a production build and then drops the branch together with the chunk. A
 * top-level import would have shipped the file.
 *
 * USAGE (dev build, browser console):
 *
 *   __piiAudit()                       // values harvested from API responses
 *   __piiAudit(['Иванов Иван'])        // explicit values, no API needed
 *
 * The argument is not decoration: in the test suite the API is mocked with
 * `vi.fn` (there is no msw in the dependencies), so no response ever reaches the
 * interceptor and the harvested set would be empty. Tests pass their fixtures in
 * directly — that is what the smoke check in phase 7.4 does.
 */

import { api } from '@/lib/api'
import { creditHttp } from '@/features/credit/api/creditApi'
import { OPENREPLAY_OBSCURED_ATTR } from './pii'

/** Attributes the tracker sends VERBATIM — see the module header of `pii.tsx`. */
const UNMASKED_ATTRS = ['title', 'alt', 'aria-label', 'placeholder'] as const

/**
 * Response-body keys whose values are letters belonging to a person.
 *
 * Deliberately the same shapes as the dictionary in `scripts/pii-audit.mjs`, so
 * the static and the runtime halves disagree about files, not about what counts
 * as personal data.
 */
const PII_KEY = /(full_?name|first_?name|last_?name|middle_?name|patronymic|address)/i

/** …minus the ones that are not a person: a network address, an enum, an email. */
const NOT_PII_KEY = /(ip_?address|mac_?address|email_?address|address_?type)/i

/** Free-text operator prose. Same advisory status as in the static audit. */
const FREE_TEXT_KEY = /^(notes|comment|comments|description)$/i

/**
 * Shortest value worth searching for.
 *
 * A two-character value produces matches all over the page by coincidence, and a
 * detector whose output is mostly noise stops being read — which is the same as
 * not having one.
 */
const MIN_VALUE_LENGTH = 4

export interface PiiAuditFinding {
  /** The API value that was found on screen in the clear. */
  value: string
  /** Where it was found: a text node's parent, or the element holding the attribute. */
  element: Element
  /** A readable path to that element, for the console table. */
  selector: string
  /** `text` — masked by markup; `attribute` — NOT maskable, the value must go. */
  where: 'text' | 'attribute'
  /** Which attribute, when `where` is `attribute`. */
  attribute?: string
}

/** Values harvested from API responses, shared by every call to the detector. */
const harvested = new Set<string>()

/** Recursively pull PII-shaped string values out of a response body. */
export function collectPiiValues(payload: unknown, into: Set<string> = new Set()): Set<string> {
  const seen = new WeakSet<object>()

  const walk = (node: unknown, key: string | null): void => {
    if (typeof node === 'string') {
      if (!key) return
      if (NOT_PII_KEY.test(key)) return
      if (!PII_KEY.test(key) && !FREE_TEXT_KEY.test(key)) return
      const value = node.trim()
      if (value.length >= MIN_VALUE_LENGTH) into.add(value)
      return
    }
    if (node === null || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item, key)
      return
    }
    for (const [childKey, child] of Object.entries(node)) walk(child, childKey)
  }

  walk(payload, null)
  return into
}

/** Is this node inside a subtree the tracker would obscure? */
function isCovered(element: Element | null): boolean {
  return !!element?.closest(`[${OPENREPLAY_OBSCURED_ATTR}]`)
}

/** A short, human-readable path — enough to find the node in the inspector. */
function describe(element: Element): string {
  const parts: string[] = []
  for (let cur: Element | null = element; cur && parts.length < 4; cur = cur.parentElement) {
    if (cur === document.body) break
    const id = cur.id ? `#${cur.id}` : ''
    const testId = cur.getAttribute('data-testid')
    const marker = testId ? `[data-testid="${testId}"]` : ''
    parts.unshift(`${cur.tagName.toLowerCase()}${id}${marker}`)
  }
  return parts.join(' > ')
}

/**
 * Find every place on screen where one of `values` is readable.
 *
 * 🔴 The walk starts at `document.body`, not at the app root: Radix dialogs,
 * dropdowns, tooltips and `sonner` toasts render into portals that are siblings
 * of the root, and inheritance does not cross into them. Starting at the root
 * would silently exempt exactly the nodes that are hardest to get right.
 */
export function findUnobscured(
  values: Iterable<string>,
  root: ParentNode = document.body
): PiiAuditFinding[] {
  const needles = [...values].filter((v) => v.length >= MIN_VALUE_LENGTH)
  if (needles.length === 0) return []

  const findings: PiiAuditFinding[] = []

  // ── Text nodes ────────────────────────────────────────────────────────────
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
        return NodeFilter.FILTER_REJECT
      }
      return node.nodeValue && node.nodeValue.trim().length >= MIN_VALUE_LENGTH
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement!
    if (isCovered(parent)) continue
    const text = node.nodeValue ?? ''
    for (const needle of needles) {
      if (!text.includes(needle)) continue
      findings.push({
        value: needle,
        element: parent,
        selector: describe(parent),
        where: 'text',
      })
      break
    }
  }

  // ── Attributes ────────────────────────────────────────────────────────────
  // NOT filtered by `isCovered`, and that is the point: outside `privateMode`
  // the tracker sends attribute values as they are, from an obscured node and
  // from a hidden one alike. Markup does not help here — the value has to go.
  const selector = UNMASKED_ATTRS.map((attr) => `[${attr}]`).join(',')
  const elements =
    root instanceof Element || root instanceof DocumentFragment
      ? root.querySelectorAll(selector)
      : document.querySelectorAll(selector)
  for (const element of elements) {
    for (const attr of UNMASKED_ATTRS) {
      const value = element.getAttribute(attr)
      if (!value || value.length < MIN_VALUE_LENGTH) continue
      for (const needle of needles) {
        if (!value.includes(needle)) continue
        findings.push({
          value: needle,
          element,
          selector: describe(element),
          where: 'attribute',
          attribute: attr,
        })
        break
      }
    }
  }

  return findings
}

/* eslint-disable no-console */

/** Run the audit and print it. Returns the findings so a test can assert on them. */
export function runPiiAudit(values?: Iterable<string>): PiiAuditFinding[] {
  const needles = values ? [...values] : [...harvested]
  const findings = findUnobscured(needles)

  if (needles.length === 0) {
    console.error(
      '__piiAudit: nothing to look for. Open a screen that loads data first, or pass ' +
        'values explicitly: __piiAudit(["Иванов Иван"]).'
    )
    return findings
  }

  if (findings.length === 0) {
    console.error(
      `__piiAudit: ✅ ${needles.length} value(s) checked, none readable on this screen.`
    )
    return findings
  }

  console.error(`__piiAudit: 🔴 ${findings.length} unmasked site(s) — see the table below.`)
  console.table(
    findings.map((finding) => ({
      value: finding.value,
      where: finding.where === 'attribute' ? `@${finding.attribute}` : 'text',
      at: finding.selector,
    }))
  )
  // The elements themselves, so the console lets you click through to them.
  console.error(findings.map((finding) => finding.element))
  return findings
}

/* eslint-enable no-console */

declare global {
  interface Window {
    /**
     * List the personal data readable on the current screen (dev builds only).
     *
     * @param values values to look for; defaults to everything seen in API
     *   responses since the page loaded.
     */
    __piiAudit?: (values?: Iterable<string>) => PiiAuditFinding[]
  }
}

/**
 * Attach the harvester and the global.
 *
 * Both axios instances, not one: the credit module talks to its own service
 * through `creditHttp`, and half the responses bypassing the harvester would
 * make the empty output meaningless.
 */
export function installPiiAudit(): void {
  if (typeof window === 'undefined') return
  if (window.__piiAudit) return

  for (const instance of [api, creditHttp]) {
    instance.interceptors.response.use(
      (response) => {
        try {
          collectPiiValues(response.data, harvested)
        } catch {
          // A detector must never be the reason a screen fails to render.
        }
        return response
      },
      (error) => Promise.reject(error)
    )
  }

  window.__piiAudit = runPiiAudit
}

// `MODE !== 'test'` keeps the interceptors out of the unit suite: the tests that
// use this module call `findUnobscured`/`runPiiAudit` with explicit fixtures and
// have no business mutating the shared axios instances.
if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
  installPiiAudit()
}
