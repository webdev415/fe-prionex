import { useEffect, useState } from 'react'

/**
 * Which section the reader is currently looking at.
 *
 * Watching the sections rather than the scroll offset keeps the answer right
 * when a section grows, collapses or loads late, none of which move the
 * offsets a fixed table of positions would have assumed.
 *
 * The top margin accounts for the bar itself: without it, the section sitting
 * directly under the bar counts as visible before the reader can see any of it.
 */
export function useScrollSpy(sectionIds: string[], topOffset = 96): string {
  const [active, setActive] = useState(sectionIds[0] ?? '')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const seen = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.intersectionRatio)
        }
        const best = sectionIds
          .map((id) => ({ id, ratio: seen.get(id) ?? 0 }))
          .filter((entry) => entry.ratio > 0)
          .sort((a, b) => b.ratio - a.ratio)[0]
        if (best) setActive(best.id)
      },
      { rootMargin: `-${topOffset}px 0px -55% 0px`, threshold: [0, 0.1, 0.5, 1] }
    )

    const watched = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    watched.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [sectionIds, topOffset])

  return active
}
