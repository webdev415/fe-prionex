import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelCalibrationSession,
  completeCalibrationSession,
  createCalibrationSession,
  getCalibrationCalendar,
  rescheduleCalibrationSession,
} from '../api/calibrationSessionsService'
import type {
  CalibrationCalendarFilters,
  CreateCalibrationSessionPayload,
} from '../types/calibrationSessions'

export const calibrationKeys = {
  all: ['training', 'calibration-sessions'] as const,
  calendar: (filters: CalibrationCalendarFilters) =>
    [...calibrationKeys.all, 'calendar', filters] as const,
}

export function useCalibrationCalendar(filters: CalibrationCalendarFilters = {}, enabled = true) {
  return useQuery({
    queryKey: calibrationKeys.calendar(filters),
    queryFn: () => getCalibrationCalendar(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useCreateCalibrationSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCalibrationSessionPayload) => createCalibrationSession(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calibrationKeys.all }),
  })
}

export function useRescheduleCalibrationSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: number; scheduledAt: string }) =>
      rescheduleCalibrationSession(id, scheduledAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calibrationKeys.all }),
  })
}

export function useCompleteCalibrationSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => completeCalibrationSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calibrationKeys.all }),
  })
}

export function useCancelCalibrationSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cancelCalibrationSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calibrationKeys.all }),
  })
}
