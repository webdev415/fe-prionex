/**
 * The editor's draft of a board configuration (planner story 5.10).
 *
 * The draft is made from the board card once and then belongs to the person:
 * sections change it, `Скасувати` puts the card back, a save replaces the card.
 * When a newer card arrives (a member command answers with one, a focus
 * re-read, the fresh card of a 412):
 * - an untouched draft simply follows it;
 * - a draft with edits keeps them, and the card becomes its base — silently
 *   when only the version moved (a member added, a policy saved: the
 *   configuration is the same), with a conflict banner when somebody else
 *   changed the configuration meanwhile: `Зберегти` would then replace their
 *   version, and the person should know that before pressing it.
 */
import { useState } from 'react'
import type { PlannerBoard } from '@/api/planner/plannerApi'
import {
  draftFromConfig,
  sameConfig,
  toConfigInput,
  withMove,
  withoutMoves,
  type ConfigDraft,
  type ConfigInput,
} from './boardSettingsModel'

interface DraftState {
  base: PlannerBoard
  draft: ConfigDraft
  /** Somebody else changed the configuration under the person's edits. */
  conflict: boolean
}

function fresh(board: PlannerBoard): DraftState {
  return { base: board, draft: draftFromConfig(board.config), conflict: false }
}

export function useConfigDraft(board: PlannerBoard | undefined) {
  const [state, setState] = useState<DraftState | null>(null)

  let current = state
  if (board && (!current || current.base.id !== board.id)) {
    current = fresh(board)
    setState(current)
  } else if (board && current && board.version > current.base.version) {
    const saved = toConfigInput(current.base.config)
    const incoming = toConfigInput(board.config)
    const edited = !sameConfig(current.draft.config, saved)
    // Untouched, or the card is exactly the draft (this editor's own save
    // landing in the cache before `saveDone`): follow the card.
    if (!edited || sameConfig(incoming, current.draft.config)) current = fresh(board)
    else if (sameConfig(incoming, saved)) current = { ...current, base: board }
    else current = { ...current, base: board, conflict: true }
    setState(current)
  }

  const saved = current ? toConfigInput(current.base.config) : undefined
  const dirty = Boolean(current && saved && !sameConfig(current.draft.config, saved))

  return {
    base: current?.base,
    draft: current?.draft,
    /** The configuration as the card has it — what «changed» is measured against. */
    saved,
    dirty,
    conflict: current?.conflict ?? false,
    update(change: (config: ConfigInput) => ConfigInput) {
      setState((prev) =>
        prev ? { ...prev, draft: { ...prev.draft, config: change(prev.draft.config) } } : prev
      )
    },
    /** Tasks of a removed status go to `to` (`move_tasks_to`); moves into `from` follow. */
    setMove(from: string, to: string) {
      setState((prev) =>
        prev
          ? { ...prev, draft: { ...prev.draft, moves: withMove(prev.draft.moves, from, to) } }
          : prev
      )
    },
    /** Forget the moves of these removed statuses — their place is asked again. */
    dropMoves(from: string[]) {
      setState((prev) =>
        prev
          ? { ...prev, draft: { ...prev.draft, moves: withoutMoves(prev.draft.moves, from) } }
          : prev
      )
    },
    /** `Скасувати`: the card as it is now. */
    reset() {
      setState((prev) => (prev ? fresh(prev.base) : prev))
    },
    /** A save went through: its card is the new base and the new draft. */
    saveDone(next: PlannerBoard) {
      setState(fresh(next))
    },
  }
}

export type ConfigDraftApi = ReturnType<typeof useConfigDraft>
