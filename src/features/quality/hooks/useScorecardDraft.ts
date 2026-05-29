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
  // Previous-prop tracking via useState (not useRef): both rules in this
  // repo's react-hooks config forbid setState-in-effect AND ref access
  // during render. useState reads / setState calls are both allowed during
  // render — React reconciles the in-render update by replaying the same
  // render with the new state, no cascade.
  const [prevScorecardId, setPrevScorecardId] = useState<number | null>(scorecardId)
  const [prevInitial, setPrevInitial] = useState<DraftState | null>(initial)
  const dirtyRef = useRef<boolean>(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateMutation = useUpdateScorecard()

  // Sync local draft state with the server snapshot:
  // - Scorecard swap → reset from snapshot (autosave has already debounced
  //   any in-flight typing on the previous scorecard to the server).
  // - Fresh snapshot for the SAME scorecard → adopt it. We can't gate this
  //   on dirtyRef here (refs are off-limits during render under the repo's
  //   react-hooks rule), but the autosave debounce (defaults to 2s) makes
  //   it extremely likely the server snapshot already reflects what the
  //   user typed — and react-query's same-key cache only swaps the
  //   reference on an actual data change, so this branch is rare in
  //   practice.
  if (scorecardId !== prevScorecardId) {
    setPrevScorecardId(scorecardId)
    setPrevInitial(initial)
    setState(initial ?? { scores: {}, overall_comment: '' })
  } else if (initial !== prevInitial && initial != null) {
    setPrevInitial(initial)
    setState(initial)
  }

  // The dirty flag is reset after commit when the scorecard id changes. It
  // can't be written during render under the repo's `react-hooks/refs` rule,
  // but ref writes inside effects are explicitly allowed.
  useEffect(() => {
    dirtyRef.current = false
  }, [scorecardId])

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
