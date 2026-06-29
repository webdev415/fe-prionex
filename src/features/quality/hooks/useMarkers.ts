import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMarkerToLibrary,
  createMarker,
  deleteMarker,
  exportMarkers,
  listMarkers,
  listMarkersForCall,
  updateMarker,
} from '../api/qualityService'
import type { MarkerCreatePayload, MarkerListFilters, MarkerUpdatePayload } from '../types'

export const markerKeys = {
  all: ['quality', 'markers'] as const,
  forCall: (callId: string) => [...markerKeys.all, 'for-call', callId] as const,
  list: (filters: MarkerListFilters) => [...markerKeys.all, 'list', filters] as const,
}

export function useMarkersForCall(callId: string | null, enabled = true) {
  return useQuery({
    queryKey:
      callId == null ? ['quality', 'markers', 'for-call', 'pending'] : markerKeys.forCall(callId),
    queryFn: () => listMarkersForCall(callId as string),
    enabled: enabled && !!callId,
    staleTime: 15_000,
  })
}

export function useMarkers(filters: MarkerListFilters, enabled = true) {
  return useQuery({
    queryKey: markerKeys.list(filters),
    queryFn: () => listMarkers(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useCreateMarker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ callId, payload }: { callId: string; payload: MarkerCreatePayload }) =>
      createMarker(callId, payload),
    onSuccess: (created) => {
      // Scope to this call's markers — a new marker doesn't change other
      // calls' lists, so don't refetch every mounted markers query.
      queryClient.invalidateQueries({ queryKey: markerKeys.forCall(created.call_id) })
    },
  })
}

export function useUpdateMarker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ markerId, payload }: { markerId: number; payload: MarkerUpdatePayload }) =>
      updateMarker(markerId, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: markerKeys.forCall(updated.call_id) })
      queryClient.invalidateQueries({ queryKey: markerKeys.all })
    },
  })
}

export function useDeleteMarker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (markerId: number) => deleteMarker(markerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: markerKeys.all })
    },
  })
}

export function useAddMarkerToLibrary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (markerId: number) => addMarkerToLibrary(markerId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: markerKeys.forCall(updated.call_id) })
      queryClient.invalidateQueries({ queryKey: markerKeys.all })
    },
  })
}

export function useExportMarkers() {
  return useMutation({
    mutationFn: (filters: MarkerListFilters) => exportMarkers(filters),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `markers-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
  })
}
