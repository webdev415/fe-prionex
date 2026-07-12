import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveMaterial,
  attachMaterialToCall,
  createMaterialCategory,
  detachMaterialFromCall,
  listMaterialCategories,
  listMaterials,
  listMaterialsForCall,
  updateMaterial,
  uploadMaterial,
} from '../api/materialsService'
import type {
  MaterialListFilters,
  MaterialUpdatePayload,
  MaterialUploadPayload,
} from '../types/materials'

export const materialsKeys = {
  all: ['training', 'materials'] as const,
  list: (filters: MaterialListFilters) => [...materialsKeys.all, 'list', filters] as const,
  categories: () => [...materialsKeys.all, 'categories'] as const,
  forCall: (callId: string) => [...materialsKeys.all, 'forCall', callId] as const,
}

export function useMaterials(filters: MaterialListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: materialsKeys.list(filters),
    queryFn: () => listMaterials(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useMaterialCategories(enabled = true) {
  return useQuery({
    queryKey: materialsKeys.categories(),
    queryFn: () => listMaterialCategories(),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useCreateMaterialCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createMaterialCategory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.categories() })
    },
  })
}

export function useUploadMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: MaterialUploadPayload) => uploadMaterial(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.all })
    },
  })
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MaterialUpdatePayload }) =>
      updateMaterial(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.all })
    },
  })
}

export function useArchiveMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => archiveMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.all })
    },
  })
}

export function useMaterialsForCall(callId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: materialsKeys.forCall(callId ?? ''),
    queryFn: () => listMaterialsForCall(callId as string),
    enabled: enabled && !!callId,
    staleTime: 30_000,
  })
}

export function useAttachMaterialToCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ materialId, callId }: { materialId: number; callId: string }) =>
      attachMaterialToCall(materialId, callId),
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.forCall(callId) })
    },
  })
}

export function useDetachMaterialFromCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ materialId, callId }: { materialId: number; callId: string }) =>
      detachMaterialFromCall(materialId, callId),
    onSuccess: (_data, { callId }) => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.forCall(callId) })
    },
  })
}
