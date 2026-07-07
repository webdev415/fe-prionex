import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getRRPeriodicitySettings,
  updateRRPeriodicitySettings,
  type RRPeriodicitySettingsUpdate,
} from '../api/rrPeriodicitySettings'

const KEY = ['rr-periodicity-settings'] as const

/**
 * Read the enabled periodicity options for the active project. Used both by
 * the admin Settings page and by the RR creation form to populate the Payment
 * Frequency dropdown, so it stays enabled for any authenticated operator.
 */
export function useRRPeriodicitySettings(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: getRRPeriodicitySettings,
    enabled,
  })
}

export function useUpdateRRPeriodicitySettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RRPeriodicitySettingsUpdate) => updateRRPeriodicitySettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
