/**
 * The operator's own presets, and the operations on them (#1100).
 *
 * Everything above this line talks to this hook rather than to the store, so
 * replacing localStorage with an endpoint is a change to one file. Callers get
 * only their own presets: the operator id never crosses this boundary, which is
 * what stops a caller from reading someone else's list by accident.
 */

import { useCallback, useMemo } from 'react'

import { useAuthStore } from '@/stores/authStore'

import { useClientFilterPresetStore } from '../store/clientFilterPresetStore'
import type { ClientFilterPreset, ClientFilterPresetParams } from '../types'

export interface ClientFilterPresetsApi {
  presets: ClientFilterPreset[]
  /** False while there is no signed-in operator to own a preset. */
  canEdit: boolean
  create: (name: string, params: ClientFilterPresetParams) => void
  update: (id: number, name: string, params: ClientFilterPresetParams) => void
  remove: (id: number) => void
}

const NONE: ClientFilterPreset[] = []

export function useClientFilterPresets(): ClientFilterPresetsApi {
  const userId = useAuthStore((state) => state.user?.id)
  const byUser = useClientFilterPresetStore((state) => state.byUser)
  const createInStore = useClientFilterPresetStore((state) => state.create)
  const updateInStore = useClientFilterPresetStore((state) => state.update)
  const removeFromStore = useClientFilterPresetStore((state) => state.remove)

  const presets = useMemo(() => (userId ? (byUser[userId] ?? NONE) : NONE), [byUser, userId])

  const create = useCallback(
    (name: string, params: ClientFilterPresetParams) => {
      if (!userId) return
      createInStore(userId, name, params)
    },
    [createInStore, userId]
  )

  const update = useCallback(
    (id: number, name: string, params: ClientFilterPresetParams) => {
      if (!userId) return
      updateInStore(userId, id, name, params)
    },
    [updateInStore, userId]
  )

  const remove = useCallback(
    (id: number) => {
      if (!userId) return
      removeFromStore(userId, id)
    },
    [removeFromStore, userId]
  )

  return { presets, canEdit: !!userId, create, update, remove }
}
