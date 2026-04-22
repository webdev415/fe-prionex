import api from '@/lib/api'
import type { BranchOut, BlockerOut, ChainBuilderData, EffectOut, TriggerOut } from './types'

const base = (chainId: number) => `/api/v1/ta-chains/${chainId}`

export async function getBuilderData(chainId: number): Promise<ChainBuilderData> {
  const r = await api.get<ChainBuilderData>(`${base(chainId)}/builder`)
  return r.data
}

// Branches
export async function createBranch(
  chainId: number,
  payload: {
    from_step_id: number
    to_step_id: number
    condition_leaf_id?: number | null
    condition_dropdown_value_id?: number | null
  }
): Promise<BranchOut> {
  return (await api.post<BranchOut>(`${base(chainId)}/branches`, payload)).data
}
export async function deleteBranch(chainId: number, branchId: number): Promise<void> {
  await api.delete(`${base(chainId)}/branches/${branchId}`)
}

// Triggers
export async function createTrigger(
  chainId: number,
  payload: { trigger_type: string; config: Record<string, unknown> }
): Promise<TriggerOut> {
  return (await api.post<TriggerOut>(`${base(chainId)}/triggers`, payload)).data
}
export async function deleteTrigger(chainId: number, triggerId: number): Promise<void> {
  await api.delete(`${base(chainId)}/triggers/${triggerId}`)
}

// Blockers
export async function createBlocker(
  chainId: number,
  payload: { blocker_type: string; config: Record<string, unknown> }
): Promise<BlockerOut> {
  return (await api.post<BlockerOut>(`${base(chainId)}/blockers`, payload)).data
}
export async function deleteBlocker(chainId: number, blockerId: number): Promise<void> {
  await api.delete(`${base(chainId)}/blockers/${blockerId}`)
}

// Effects
export async function createEffect(
  chainId: number,
  payload: { step_id: number; effect_type: string; config: Record<string, unknown> }
): Promise<EffectOut> {
  return (await api.post<EffectOut>(`${base(chainId)}/effects`, payload)).data
}
export async function deleteEffect(chainId: number, effectId: number): Promise<void> {
  await api.delete(`${base(chainId)}/effects/${effectId}`)
}
