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
  /**
   * When false, the hook does NOT flush on unmount. Used by the explicit-save
   * flow (KAN-504), where closing with unsaved changes warns the trainer
   * instead of silently persisting.
   */
  flushOnUnmount?: boolean
}

const EMPTY_DRAFT: DraftState = { scores: {}, overall_comment: '' }

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
  flushOnUnmount = true,
}: UseScorecardDraftArgs) {
  const [state, setState] = useState<DraftState>(initial ?? EMPTY_DRAFT)
  // Render-time adjustment (React docs pattern) — replaces the
  // setState-in-effect block flagged by react-hooks/set-state-in-effect.
  const [trackedScorecardId, setTrackedScorecardId] = useState<number | null>(scorecardId)
  const [trackedInitial, setTrackedInitial] = useState<DraftState | null>(initial)
  const [dirty, setDirty] = useState(false)
  // Mirror `dirty` into a ref so the debounce timer + unmount-flush cleanup
  // can read the latest value without re-creating themselves on every flip.
  // Refs are only touched inside effects and callbacks, never during render.
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateMutation = useUpdateScorecard()

  if (scorecardId !== trackedScorecardId) {
    // Editor swapped to a different scorecard — reset from the server snapshot.
    setTrackedScorecardId(scorecardId)
    setTrackedInitial(initial)
    setState(initial ?? EMPTY_DRAFT)
    setDirty(false)
  } else if (initial !== trackedInitial && initial != null && !dirty) {
    // Same scorecard, but a fresher server snapshot arrived (refetch). Adopt
    // it only if the user hasn't typed anything dirty.
    setTrackedInitial(initial)
    setState(initial)
  }

  const flush = useCallback(async () => {
    if (!scorecardId || !dirtyRef.current) return
    setDirty(false)
    const payload: ScorecardUpdatePayload = {
      scores: state.scores,
      overall_comment: state.overall_comment || null,
    }
    await updateMutation.mutateAsync({ scorecardId, payload })
  }, [scorecardId, state, updateMutation])

  // Debounced autosave.
  useEffect(() => {
    if (!enabled || !scorecardId || !dirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void flush()
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state, enabled, scorecardId, debounceMs, dirty, flush])

  // Flush on unmount so closing the modal doesn't drop the last edit —
  // unless the caller opts out (explicit-save flow warns instead).
  useEffect(() => {
    return () => {
      if (flushOnUnmount && dirtyRef.current) void flush()
    }
  }, [flush, flushOnUnmount])

  const setScore = useCallback(
    (criterionKey: string, value: number | boolean | null, comment?: string | null) => {
      setDirty(true)
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
    setDirty(true)
    setState((prev) => ({ ...prev, overall_comment: next }))
  }, [])

  const reset = useCallback((next: DraftState) => {
    setDirty(false)
    setState(next)
  }, [])

  return {
    scores: state.scores,
    overallComment: state.overall_comment,
    setScore,
    setOverallComment,
    reset,
    flush,
    isDirty: dirty,
    isSaving: updateMutation.isPending,
    saveError: updateMutation.error,
  }
}
