import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScoresPayload, ScorecardUpdatePayload } from '../types'
import { useUpdateScorecard } from './useScorecards'

interface DraftState {
  scores: ScoresPayload
  overall_comment: string
  /** Why the trainer disagrees with the AI. '' = no objection recorded. */
  dispute_reason: string
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

const EMPTY_DRAFT: DraftState = { scores: {}, overall_comment: '', dispute_reason: '' }

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
  // Mirror state so `flush` can read the latest values without listing `state`
  // in its deps — otherwise flush's identity changes every keystroke and the
  // effects below re-run (and their cleanups fire) on every render.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
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

  const { mutateAsync } = updateMutation
  const flush = useCallback(async () => {
    if (!scorecardId || !dirtyRef.current) return
    setDirty(false)
    const payload: ScorecardUpdatePayload = {
      scores: stateRef.current.scores,
      overall_comment: stateRef.current.overall_comment || null,
      // Explicit `null`, never `undefined`: clearing the textarea has to reach
      // the backend as "this is no longer a dispute". An omitted key would
      // leave the old reason standing behind an empty field.
      dispute_reason: stateRef.current.dispute_reason || null,
    }
    await mutateAsync({ scorecardId, payload })
  }, [scorecardId, mutateAsync])

  // Keep the latest flush/opt-out in refs so the unmount effect can register
  // once (empty deps) and fire only on true unmount, not on every render.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])
  const flushOnUnmountRef = useRef(flushOnUnmount)
  useEffect(() => {
    flushOnUnmountRef.current = flushOnUnmount
  }, [flushOnUnmount])

  // Debounced autosave. Keyed on state/dirty/config only — never reset by an
  // unrelated re-render, since it reads flush from a ref.
  useEffect(() => {
    if (!enabled || !scorecardId || !dirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void flushRef.current()
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state, enabled, scorecardId, debounceMs, dirty])

  // Flush on unmount so closing the modal doesn't drop the last edit —
  // unless the caller opts out (explicit-save flow warns instead).
  useEffect(() => {
    return () => {
      if (flushOnUnmountRef.current && dirtyRef.current) void flushRef.current()
    }
  }, [])

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

  const setDisputeReason = useCallback((next: string) => {
    setDirty(true)
    setState((prev) => ({ ...prev, dispute_reason: next }))
  }, [])

  const reset = useCallback((next: DraftState) => {
    setDirty(false)
    setState(next)
  }, [])

  return {
    scores: state.scores,
    overallComment: state.overall_comment,
    disputeReason: state.dispute_reason,
    setScore,
    setOverallComment,
    setDisputeReason,
    reset,
    flush,
    isDirty: dirty,
    isSaving: updateMutation.isPending,
    saveError: updateMutation.error,
  }
}
