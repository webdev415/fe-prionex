/**
 * Step options for the client-list Step picker (KAN-821).
 *
 * The Chain filter became multi-select, so the Step list is the union of every
 * picked chain's steps rather than one chain's. Step ids are globally unique,
 * so the backend still resolves each pick back to its own chain — the only
 * thing that breaks is the label: two chains commonly have a step with the same
 * target-action name ("Contact"), and side by side in one dropdown they'd be
 * indistinguishable. So the chain name is prefixed, but only when it's needed.
 *
 * Extracted from ``ClientFiltersBar`` to be testable on its own: the picker is
 * a Radix menu, which doesn't open under jsdom without pointer-capture
 * polyfills, and the labelling rule is worth guarding regardless.
 */

import type { TAChain, TAChainStep } from '@/features/taChains/api/types'

export function buildChainStepOptions(selectedChains: TAChain[]): TAChainStep[] {
  // One chain (or none): labels are already unambiguous, so leave them alone.
  if (selectedChains.length <= 1) return selectedChains[0]?.steps ?? []

  return selectedChains.flatMap((chain) =>
    (chain.steps ?? []).map((step) => ({
      ...step,
      target_action_name: `${chain.name} — ${step.target_action_name ?? ''}`,
    }))
  )
}
