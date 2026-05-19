import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScoresPayload, ScorecardUpdatePayload } from '../types'
import { useUpdateScorecard } from './useScorecards'

interface DraftState {
  scores: ScoresPayload
  overall_comment: string
}

interface UseScorecardDraftArgs {
  scorecardId: number | null
  /** Server snapshot — used to initialize local state when a scorecard is opened. */
  initial: DraftState | null
  /** When false, autosave is paused (e.g. while the panel is closed). */
  enabled?: boolean
  /** Debounce window in ms; defaults to 2000 (the plan's spec). */
  debounceMs?: number
}

/**
 * Local draft state with debounced autosave to the server.
 *
 * The plan's acceptance criterion 2.1 ("Trainer can save draft and return
 * later") is satisfied via the persisted server row; this hook covers the
 * few-second window between keystrokes and persistence by mirroring state
 * locally and flushing on debounce.
 *
 * The hook deliberately does NOT persist to localStorage in v1 — the
 * server is the source of truth, and the autosave window is short enough
 * that a refresh inside it is acceptable risk.
 */
export function useScorecardDraft({
  scorecardId,
  initial,
  enabled = true,
  debounceMs = 2000,
}: UseScorecardDraftArgs) {
  const [state, setState] = useState<DraftState>(initial ?? { scores: {}, overall_comment: '' })
  const initialKeyRef = useRef<number | null>(scorecardId)
  const dirtyRef = useRef<boolean>(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateMutation = useUpdateScorecard()

  // When the editor swaps to a different scorecard, reset local state from
  // the server snapshot.
  useEffect(() => {
    if (scorecardId !== initialKeyRef.current) {
      initialKeyRef.current = scorecardId
      dirtyRef.current = false
      setState(initial ?? { scores: {}, overall_comment: '' })
    } else if (initial != null && !dirtyRef.current) {
      setState(initial)
    }
  }, [scorecardId, initial])

  const flush = useCallback(async () => {
    if (!scorecardId || !dirtyRef.current) return
    dirtyRef.current = false
    const payload: ScorecardUpdatePayload = {
      scores: state.scores,
      overall_comment: state.overall_comment || null,
    }
    await updateMutation.mutateAsync({ scorecardId, payload })
  }, [scorecardId, state, updateMutation])

  // Debounced autosave.
  useEffect(() => {
    if (!enabled || !scorecardId || !dirtyRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void flush()
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state, enabled, scorecardId, debounceMs, flush])

  // Flush on unmount so closing the modal doesn't drop the last edit.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) void flush()
    }
  }, [flush])

  const setScore = useCallback(
    (criterionKey: string, value: number | boolean | null, comment?: string | null) => {
      dirtyRef.current = true
      setState((prev) => ({
        ...prev,
        scores: {
          ...prev.scores,
          [criterionKey]: { value, comment: comment ?? prev.scores[criterionKey]?.comment ?? null },
        },
      }))
    },
    []
  )

  const setOverallComment = useCallback((next: string) => {
    dirtyRef.current = true
    setState((prev) => ({ ...prev, overall_comment: next }))
  }, [])

  const reset = useCallback((next: DraftState) => {
    dirtyRef.current = false
    setState(next)
  }, [])

  return {
    scores: state.scores,
    overallComment: state.overall_comment,
    setScore,
    setOverallComment,
    reset,
    flush,
    isSaving: updateMutation.isPending,
    saveError: updateMutation.error,
  }
}
