import { useCallback, useEffect, useRef, useState } from 'react'

/** How far the sticky header reaches down the card's scroll container. */
export const CARD_HEADER_OFFSET = 128

/** How long the card must be still before scrolling speaks for the reader again. */
const SETTLED_MS = 150

/**
 * The container a section actually scrolls inside.
 *
 * The card brings its own, so the answer is not the window: sections move
 * against that element, and reading the window's scroll here would report a
 * page that never moves.
 */
export function scrollParent(node: HTMLElement | null): HTMLElement | null {
  for (let element = node?.parentElement; element; element = element.parentElement) {
    const overflow = getComputedStyle(element).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return element
  }
  return null
}

export interface ScrollSpy {
  /** The section the reader is in. */
  active: string
  /** Say the reader has asked for a section, and hold it until scrolling settles. */
  select: (id: string) => void
}

/**
 * Which section the reader is currently looking at.
 *
 * The rule is "the last section whose top has passed under the header", which
 * is what a reader means by the section they are in - everything above that
 * line has been read past, and what sits under the line is what they are
 * reading.
 *
 * It measures live rather than trusting remembered rectangles. Ranking by
 * ``IntersectionObserver`` ratio, as this once did, ranks by a fraction of
 * each section's OWN height: a short section fully inside the reading band
 * scores 1 while a tall one crossing it scores a fraction, so the short one
 * wins even when the tall one fills the screen.
 *
 * ``ready`` says the sections are on the page. Until the card's request
 * answers there is nothing to find, and nothing here changes afterwards to
 * make it look again - so without it the bar would never follow the reader on
 * a cold load, only on one where the card was already in hand.
 *
 * ``select`` exists because a click is not a guess. The last sections of the
 * card may all fit on one screen, and then no amount of scrolling can push the
 * final one's top under the header - so asking for it and having the underline
 * refuse to move is the ordinary case, not an edge one. A chosen section holds
 * until the card has been still for a moment, after which scrolling speaks for
 * the reader again.
 */
export function useScrollSpy(
  sectionIds: string[],
  topOffset = CARD_HEADER_OFFSET,
  ready = true
): ScrollSpy {
  const [active, setActive] = useState(sectionIds[0] ?? '')
  const chosen = useRef<string | null>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hold = useCallback((id: string) => {
    chosen.current = id
    setActive(id)
  }, [])

  useEffect(() => {
    if (!ready) return

    const found = sectionIds
      .map((id) => ({ id, element: document.getElementById(id) }))
      .filter((entry): entry is { id: string; element: HTMLElement } => entry.element !== null)
    if (found.length === 0) return

    const container = scrollParent(found[0].element)

    const pick = () => {
      if (chosen.current) return

      const line = (container?.getBoundingClientRect().top ?? 0) + topOffset
      let current = found[0].id
      for (const { id, element } of found) {
        if (element.getBoundingClientRect().top <= line + 1) current = id
      }
      setActive(current)
    }

    /*
     * The flag is raised before the frame is asked for, not from its id. The
     * id is only assigned once ``requestAnimationFrame`` returns, so a
     * callback that runs before it - which is every callback under a
     * synchronous stub, and any browser that fires one re-entrantly - clears a
     * variable that is then immediately set again, and every later scroll is
     * dropped as already queued.
     */
    let pending = false
    let frame = 0
    const onScroll = () => {
      if (settle.current) clearTimeout(settle.current)
      settle.current = setTimeout(() => {
        chosen.current = null
        pick()
      }, SETTLED_MS)

      if (pending) return
      pending = true
      frame = requestAnimationFrame(() => {
        pending = false
        pick()
      })
    }

    pick()
    const target: HTMLElement | Window = container ?? window
    target.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (settle.current) clearTimeout(settle.current)
      target.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [sectionIds, topOffset, ready])

  return { active, select: hold }
}
