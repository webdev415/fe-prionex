import { useEffect, useState } from 'react'
import { CARD_HEADER_OFFSET, scrollParent } from './useScrollSpy'

/**
 * How much empty space the card needs after its last section.
 *
 * Clicking a tab scrolls that section's top up to the header. The last section
 * cannot do that on its own: once the container is scrolled to its end there
 * is nothing left to move, so the section stops wherever it happens to sit and
 * the tab looks like it did nothing. What is missing is somewhere to scroll
 * to.
 *
 * The gap is exactly what the last section falls short by - the room under the
 * header, less its own height - so it is zero whenever the last section is
 * already tall enough, and never leaves more blank space than it has to.
 *
 * ``ready`` says the sections are on the page. The card renders nothing until
 * its request answers, so on a cold load this runs while the page holds only
 * the word "Loading" - and with nothing to measure and no dependency that ever
 * changes, it would give up for good and the gap would stay zero.
 */
export function useTailSpace(
  lastSectionId: string,
  offset = CARD_HEADER_OFFSET,
  ready = true
): number {
  const [space, setSpace] = useState(0)

  useEffect(() => {
    if (!ready) return

    const last = document.getElementById(lastSectionId)
    if (!last) return

    const container = scrollParent(last)

    const measure = () => {
      const room = (container?.clientHeight ?? window.innerHeight) - offset
      setSpace(Math.max(0, room - last.offsetHeight))
    }

    measure()

    // Sections grow as they load and as somebody edits them, and the container
    // follows the window, so neither height can be measured once and trusted.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure())
    observer?.observe(last)
    if (container) observer?.observe(container)
    window.addEventListener('resize', measure)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [lastSectionId, offset, ready])

  return space
}
