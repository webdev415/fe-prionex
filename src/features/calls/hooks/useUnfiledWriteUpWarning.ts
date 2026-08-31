import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

/**
 * Tell the operator when a new call takes over a write-up they never filed.
 *
 * The window is keyed per call, so the next one remounts it empty and whatever
 * was typed goes with it. The queue's wrap-up time is a few seconds and a
 * write-up takes longer, so this is ordinary rather than exceptional.
 *
 * The report is keyed by call, and a report of "nothing unfiled" only ever
 * clears the call it names. That matters more than it looks: React flushes a
 * child's effects before its parent's, so on the commit where one call replaces
 * another the successor mounts and reports its own empty draft *before* this
 * hook's effect runs. A single boolean is false by the time it is read, and the
 * warning can never fire — which is exactly how the first version of this
 * failed, silently, with unit tests passing.
 */
export function useUnfiledWriteUpWarning(callId: string | null | undefined) {
  const { t } = useTranslation('common')
  // The call known to be holding an unfiled write-up, if any.
  const pendingRef = useRef<string | null>(null)
  const shownRef = useRef<string | null>(null)

  const reportUnfiled = useCallback((reportedCallId: string, unfiled: boolean) => {
    if (unfiled) {
      pendingRef.current = reportedCallId
      return
    }
    // Only the call that named itself may clear it. A successor reporting its
    // own empty form must not answer for its predecessor.
    if (pendingRef.current === reportedCallId) pendingRef.current = null
  }, [])

  useEffect(() => {
    const next = callId ?? null
    const previous = shownRef.current
    shownRef.current = next
    // Only a replacement — one call giving way directly to another. Closing a
    // window yourself is a decision, not a loss to be reported back to you.
    if (!next || !previous || next === previous) return
    if (pendingRef.current !== previous) return
    pendingRef.current = null
    toast.warning(
      t(
        'pages.clients.modals.callDialog.previousWriteUpLost',
        'The previous call was not written up — that interaction was not saved.'
      )
    )
  }, [callId, t])

  return reportUnfiled
}
