/**
 * `?task=KEY` — the task panel on any screen of the section (UX C-04).
 */
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export function usePlannerTaskParam() {
  const [params, setParams] = useSearchParams()
  const taskKey = params.get('task')

  const openTask = useCallback(
    (key: string) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('task', key)
        return next
      }),
    [setParams]
  )

  const closeTask = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('task')
        return next
      }),
    [setParams]
  )

  return { taskKey, openTask, closeTask }
}
