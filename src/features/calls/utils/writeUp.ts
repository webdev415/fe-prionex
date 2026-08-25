import type { CallInteractionDraftState } from '../components/CallInteractionForm'

/**
 * Whether this window holds work the operator would lose without being told.
 *
 * The communication channel is deliberately not evidence: the form defaults it
 * to the first option and reports it the moment that select is touched, so
 * counting it would warn on calls where nothing was written at all. Only a
 * result, a reason or a comment means somebody wrote something.
 */
export function hasUnfiledWriteUp(
  draft: Partial<CallInteractionDraftState>,
  alreadyFiled: boolean
): boolean {
  if (alreadyFiled) return false
  return Boolean(draft.resultId || draft.reasonId || draft.comment?.trim())
}
