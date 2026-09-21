/**
 * Admin hooks for a project's calling window and holiday calendar (KAN-1107).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/callingWindowApi'
import type { CallingWindowInput } from '../types'

export const callingWindowKeys = {
  window: (projectId: number) => ['callingWindow', projectId] as const,
  countries: () => ['holidayCountries'] as const,
  subdivisions: (country: string) => ['holidaySubdivisions', country] as const,
  calendar: (projectId: number, year: number) => ['holidayCalendar', projectId, year] as const,
}

export function useCallingWindow(projectId: number | null) {
  return useQuery({
    queryKey: callingWindowKeys.window(projectId ?? 0),
    queryFn: () => api.getCallingWindow(projectId as number),
    enabled: projectId != null,
  })
}

export function useSetCallingWindow(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CallingWindowInput) => api.setCallingWindow(projectId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(callingWindowKeys.window(projectId), updated)
      // The calendar depends on the country, so a country change invalidates
      // every year already generated for this project.
      queryClient.invalidateQueries({ queryKey: ['holidayCalendar', projectId] })
    },
  })
}

export function useHolidayCountries(enabled = true) {
  return useQuery({
    queryKey: callingWindowKeys.countries(),
    queryFn: api.getHolidayCountries,
    enabled,
    // The list is a property of the pinned package, not of our data.
    staleTime: Infinity,
  })
}

export function useSubdivisions(country: string | null) {
  return useQuery({
    queryKey: callingWindowKeys.subdivisions(country ?? ''),
    queryFn: () => api.getSubdivisions(country as string),
    enabled: Boolean(country),
    staleTime: Infinity,
  })
}

/**
 * A year's calendar. A 404 is a real state — "not generated yet" — so it is
 * not retried and the caller distinguishes it from an empty calendar.
 */
export function useHolidayCalendar(projectId: number | null, year: number) {
  return useQuery({
    queryKey: callingWindowKeys.calendar(projectId ?? 0, year),
    queryFn: () => api.getHolidayCalendar(projectId as number, year),
    enabled: projectId != null,
    retry: false,
  })
}

export function useGenerateHolidayCalendar(projectId: number, year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (replace: boolean) => api.generateHolidayCalendar(projectId, year, replace),
    onSuccess: (calendar) => {
      queryClient.setQueryData(callingWindowKeys.calendar(projectId, year), calendar)
    },
  })
}

export function useAddHolidayDate(projectId: number, year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, name }: { date: string; name?: string }) =>
      api.addHolidayDate(projectId, year, date, name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: callingWindowKeys.calendar(projectId, year),
      })
    },
  })
}

export function useRemoveHolidayDate(projectId: number, year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => api.removeHolidayDate(projectId, year, date),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: callingWindowKeys.calendar(projectId, year),
      })
    },
  })
}

export function useConfirmHolidayCalendar(projectId: number, year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.confirmHolidayCalendar(projectId, year),
    onSuccess: (calendar) => {
      queryClient.setQueryData(callingWindowKeys.calendar(projectId, year), calendar)
    },
  })
}
