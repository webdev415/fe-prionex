/**
 * The operator's own presets, and the operations on them (#1100).
 *
 * Everything above this line talks to this hook rather than to the endpoints,
 * which is what kept the feature buildable while the storage question was open.
 * Callers get only their own presets: the operator comes from the token, so the
 * id never crosses this boundary and cannot be asked for.
 *
 * The list is fetched on demand — the client-list menu only needs it once
 * opened, and an operator who never uses presets should not pay for a request
 * on every visit to the page.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as presetsApi from '../api/clientFilterPresetsApi'
import type { ClientFilterPreset, ClientFilterPresetParams } from '../types'

export const clientFilterPresetKeys = {
  all: ['client-filter-presets'] as const,
}

export interface ClientFilterPresetsApi {
  presets: ClientFilterPreset[]
  isLoading: boolean
  isError: boolean
  create: (name: string, params: ClientFilterPresetParams) => Promise<void>
  update: (id: number, name: string, params: ClientFilterPresetParams) => Promise<void>
  remove: (id: number) => Promise<void>
}

const NONE: ClientFilterPreset[] = []

/** True when the server refused a name the operator already uses. */
export function isDuplicateNameError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | undefined)?.response?.status
  return status === 409
}

export function useClientFilterPresets(enabled = true): ClientFilterPresetsApi {
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: clientFilterPresetKeys.all,
    queryFn: presetsApi.getClientFilterPresets,
    enabled,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: clientFilterPresetKeys.all })
  }

  const createMutation = useMutation({
    mutationFn: presetsApi.createClientFilterPreset,
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: presetsApi.SaveClientFilterPresetInput }) =>
      presetsApi.updateClientFilterPreset(id, input),
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: presetsApi.deleteClientFilterPreset,
    onSuccess: invalidate,
  })

  return {
    presets: data?.presets ?? NONE,
    isLoading,
    isError,
    create: async (name, params) => {
      await createMutation.mutateAsync({ name, params })
    },
    update: async (id, name, params) => {
      await updateMutation.mutateAsync({ id, input: { name, params } })
    },
    remove: async (id) => {
      await removeMutation.mutateAsync(id)
    },
  }
}
