/**
 * The live region that says a list's new order after «Вище / Нижче» (planner
 * story 5.10; WCAG 4.1.3).
 */
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * A polite live region for a list's new order («В роботі» — позиція 1 з 4).
 * The region is always in the DOM (a region created together with its text
 * is often not read out); `announce` swaps its text.
 */
export function useOrderAnnouncer(): [ReactNode, (message: string) => void] {
  const [message, setMessage] = useState('')
  const announce = useCallback((next: string) => {
    // The same text twice in a row would not be read again: clear it first.
    setMessage('')
    window.setTimeout(() => setMessage(next), 0)
  }, [])
  const region = (
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </span>
  )
  return [region, announce]
}
