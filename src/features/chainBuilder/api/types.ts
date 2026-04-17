export interface BranchOut {
  id: number
  from_step_id: number
  to_step_id: number
  condition_leaf_id: number | null
}

export interface TriggerOut {
  id: number
  chain_id: number
  trigger_type: string
  config: Record<string, unknown>
}

export interface BlockerOut {
  id: number
  chain_id: number
  blocker_type: string
  config: Record<string, unknown>
}

export interface EffectOut {
  id: number
  step_id: number
  effect_type: string
  config: Record<string, unknown>
}

export interface ChainBuilderData {
  chain_id: number
  branches: BranchOut[]
  triggers: TriggerOut[]
  blockers: BlockerOut[]
  effects: EffectOut[]
}
