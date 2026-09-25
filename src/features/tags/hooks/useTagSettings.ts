/**
 * useTagSettings — React Query hooks for tag-service backend settings.
 *
 * Replaces the previous Zustand persist+localStorage MVP. Local edits live
 * in the existing `useTagConfigStore` "dirty" buffer; this hook handles the
 * round-trip with backend (`/api/v1/tags/settings`).
 *
 * Falls back gracefully if backend doesn't yet expose the endpoints (PR2-BE
 * may not be merged + deployed at the moment this code ships): a 404 leaves
 * the store on its baked-in DEFAULT_CONFIG with `is_default=true`.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import {
  getTagSettings,
  putTagSettings,
  resetTagSettings,
  type TagSettingsResponse,
  type TagSettingsValue,
} from '../api/tagSettingsApi'

export const tagSettingsKeys = {
  all: ['tag-settings'] as const,
  current: () => [...tagSettingsKeys.all, 'current'] as const,
}

export function useTagSettings() {
  return useQuery<TagSettingsResponse | null>({
    queryKey: tagSettingsKeys.current(),
    queryFn: async () => {
      try {
        return await getTagSettings()
      } catch (err: unknown) {
        // Backend may not be deployed yet — silently fall through to local defaults.
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 404) return null
        throw err
      }
    },
    staleTime: 60_000,
  })
}

export function usePutTagSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: TagSettingsValue) => putTagSettings(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagSettingsKeys.all })
      toast.success(i18n.t('toasts.tags.settingsSaved', { defaultValue: 'Tag settings saved' }))
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to save tag settings'
      toast.error(message)
    },
  })
}

export function useResetTagSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => resetTagSettings(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagSettingsKeys.all })
      toast.success(
        i18n.t('toasts.tags.settingsReset', { defaultValue: 'Tag settings reset to defaults' })
      )
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to reset tag settings'
      toast.error(message)
    },
  })
}
