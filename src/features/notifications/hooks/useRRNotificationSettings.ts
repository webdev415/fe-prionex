import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getRRNotificationSettings,
  updateRRNotificationSettings,
  type RRNotificationSettingsUpdate,
} from '../api/rrSettings'

const KEY = ['rr-notification-settings'] as const

export function useRRNotificationSettings(projectId: number | undefined) {
  return useQuery({
    queryKey: [...KEY, projectId ?? null],
    queryFn: () => getRRNotificationSettings(projectId as number),
    enabled: !!projectId && projectId > 0,
  })
}

export function useUpdateRRNotificationSettings(projectId: number | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RRNotificationSettingsUpdate) =>
      updateRRNotificationSettings(projectId as number, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
