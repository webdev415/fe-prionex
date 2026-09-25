import { useCallback, useEffect, useState } from 'react'
import {
  buildKnownPhoneSet,
  classifyPhone,
  findPhoneMatches,
  type PhoneHighlightState,
  type PhoneLookupContact,
} from '@/features/clients/utils/phoneHighlight'

/** The attribute the walk stamps on each wrapped number. Also the idempotency
 *  guard: text already inside one of these is never rewritten again. */
const PHONE_ATTR = 'data-phone'
const STATE_ATTR = 'data-phone-state'

/** Where the highlighter looks. Added by SaleNoteCard — no imported creditor
 *  comment carries it, so this is ours to place and ours to find. */
const COMMENT_SELECTOR = '[data-cc="comment-body"]'

const CLASS_BASE = 'cursor-pointer rounded px-0.5 transition-colors'
const CLASS_BY_STATE: Record<PhoneHighlightState, string> = {
  known: 'bg-green-100 text-green-900 hover:bg-green-200',
  new: 'bg-orange-100 text-orange-900 hover:bg-orange-200',
}

export interface SelectedPhone {
  phone: string
  state: PhoneHighlightState
  /** The wrapped `<span>`, so the dropdown can position against it. */
  anchor: HTMLElement
}

interface Options {
  /** The subtree to search. Usually the notes list, which may hold several. */
  container: HTMLElement | null
  /** The client's contacts; only PHONE-typed ones make a number "known". */
  contacts: readonly PhoneLookupContact[] | null | undefined
  /**
   * Note ids plus the expanded flag — re-runs the walk when "show more" reveals
   * cards that were never walked.
   *
   * It is NOT the safety net. Being derived from ids and lengths, it cannot see
   * the subtree being rebuilt with the same text, which is precisely how every
   * span once disappeared with nothing left to restore them. The MutationObserver
   * below covers that; this only avoids waiting on an observer callback for the
   * expand case.
   */
  signature: string
}

function isAlreadyWrapped(node: Text): boolean {
  return node.parentElement?.hasAttribute(PHONE_ATTR) ?? false
}

/**
 * Wrap every phone number in each comment body under `container`.
 *
 * Idempotent: text already inside a `[data-phone]` span is rejected by the
 * walker, so a second pass over an already-wrapped comment mutates nothing.
 * The MutationObserver below depends on that — a walk that kept rewriting
 * would re-arm the observer with its own work and never settle.
 *
 * That rejection is also why existing spans are RE-CLASSIFIED first (review
 * M4). The walker cannot see them, so their state was written once and never
 * again: a number added as a contact from the panel stayed orange, kept saying
 * "not a contact" and kept offering an Add contact the duplicate check would
 * then refuse. Only a reload fixed it, because the memo on the note card
 * deliberately stops React rebuilding the subtree.
 */
function highlightPhones(container: HTMLElement, known: ReadonlySet<string>): void {
  for (const body of container.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)) {
    // Existing spans: update only what actually changed. The observer watches
    // childList/subtree and not attributes, so a write here cannot re-arm it —
    // but an unconditional write would still churn the class of every number in
    // the comment on every pass, for nothing.
    for (const span of body.querySelectorAll<HTMLElement>(`[${PHONE_ATTR}]`)) {
      const current = span.getAttribute(PHONE_ATTR)
      if (!current) continue
      const state = classifyPhone(current, known)
      if (span.getAttribute(STATE_ATTR) === state) continue
      span.setAttribute(STATE_ATTR, state)
      span.className = `${CLASS_BASE} ${CLASS_BY_STATE[state]}`
    }

    // Gathered before any rewriting: replacing a node mid-walk invalidates the
    // TreeWalker, and the remaining numbers would be skipped.
    const targets: Text[] = []
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node as Text
        if (isAlreadyWrapped(text)) return NodeFilter.FILTER_REJECT
        const tag = text.parentElement?.tagName
        if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT
        return text.nodeValue && text.nodeValue.includes('380')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
      },
    })
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      targets.push(node as Text)
    }

    for (const node of targets) {
      const text = node.nodeValue ?? ''
      const matches = findPhoneMatches(text)
      if (matches.length === 0) continue

      const fragment = document.createDocumentFragment()
      let cursor = 0
      for (const match of matches) {
        if (match.index > cursor) {
          fragment.append(text.slice(cursor, match.index))
        }
        const state = classifyPhone(match.value, known)
        const span = document.createElement('span')
        span.setAttribute(PHONE_ATTR, match.value)
        span.setAttribute(STATE_ATTR, state)
        // role/tabindex so the number is reachable without a mouse. No
        // aria-label and no title: the tracker sends both verbatim even from
        // obscured nodes, which would leak the number the comment masks.
        span.setAttribute('role', 'button')
        span.setAttribute('tabindex', '0')
        span.className = `${CLASS_BASE} ${CLASS_BY_STATE[state]}`
        span.textContent = match.value
        fragment.append(span)
        cursor = match.index + match.length
      }
      if (cursor < text.length) fragment.append(text.slice(cursor))

      node.parentNode?.replaceChild(fragment, node)
    }
  }
}

/**
 * Highlight Ukrainian phone numbers inside the primary creditor's comment and
 * report which one the operator clicked (KAN-1212).
 *
 * The comment arrives as HTML and is injected with `dangerouslySetInnerHTML`,
 * so this walks TEXT NODES rather than running a replace over the string: a
 * string replace would also match inside tags and attributes, and a number that
 * happened to appear in an `href` or a `title` would be rewritten into broken
 * markup.
 *
 * Clicks are handled by ONE delegated listener on the container rather than a
 * listener per number. A comment can carry dozens, the spans are created
 * outside React, and re-walking would otherwise have to rebind every one.
 */
export function useCommentPhoneHighlight({ container, contacts, signature }: Options) {
  const [selected, setSelected] = useState<SelectedPhone | null>(null)

  const clear = useCallback(() => setSelected(null), [])

  useEffect(() => {
    if (!container) return

    const known = buildKnownPhoneSet(contacts)
    const walk = () => highlightPhones(container, known)

    walk()

    // Watch the subtree rather than trusting the signature.
    //
    // The signature is derived from note ids and lengths, so it cannot see the
    // DOM being REBUILT with the same text — and when that happens every span
    // disappears, taking the highlighting and the click targets with it, with
    // nothing left to re-run the walk. That is exactly the "numbers go plain
    // and stop responding" failure.
    //
    // Observing is deliberately trigger-agnostic: whatever re-creates the
    // subtree, the walk runs again. It terminates because the walk is
    // idempotent — once every number is wrapped it mutates nothing, so the
    // observer is not re-armed by its own work.
    const observer = new MutationObserver(() => {
      walk()
      // An open panel may be anchored to a span that has just been replaced.
      // Functional update, so this never reads a stale `selected`.
      setSelected((current) => (current && !current.anchor.isConnected ? null : current))
    })
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [container, contacts, signature])

  useEffect(() => {
    if (!container) return

    const onActivate = (event: Event) => {
      const target = event.target as Element | null
      const span = target?.closest<HTMLElement>(`[${PHONE_ATTR}]`)
      if (!span || !container.contains(span)) return
      const phone = span.getAttribute(PHONE_ATTR)
      if (!phone) return
      const state = (span.getAttribute(STATE_ATTR) as PhoneHighlightState) ?? 'new'
      setSelected((current) =>
        // Clicking the open number closes it, so the span behaves as a toggle.
        current?.anchor === span ? null : { phone, state, anchor: span }
      )
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!target?.closest(`[${PHONE_ATTR}]`)) return
      event.preventDefault()
      onActivate(event)
    }

    container.addEventListener('click', onActivate)
    container.addEventListener('keydown', onKey)
    return () => {
      container.removeEventListener('click', onActivate)
      container.removeEventListener('keydown', onKey)
    }
  }, [container])

  return { selected, clear }
}
