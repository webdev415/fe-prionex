import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveMaterial,
  attachMaterial,
  attachMaterialToCall,
  createMaterialCategory,
  createMaterialLink,
  detachMaterial,
  detachMaterialFromCall,
  listMaterialCategories,
  listMaterials,
  listMaterialsForCall,
  listMaterialsForTarget,
  updateMaterial,
  uploadMaterial,
} from '../api/materialsService'
import type {
  MaterialAttachmentTarget,
  MaterialLinkPayload,
  MaterialListFilters,
  MaterialUpdatePayload,
  MaterialUploadPayload,
} from '../types/materials'

export const materialsKeys = {
  all: ['training', 'materials'] as const,
  list: (filters: MaterialListFilters) => [...materialsKeys.all, 'list', filters] as const,
  categories: () => [...materialsKeys.all, 'categories'] as const,
  forCall: (callId: string) => [...materialsKeys.all, 'forCall', callId] as const,
  forTarget: (targetType: MaterialAttachmentTarget, targetId: number) =>
    [...materialsKeys.all, 'forTarget', targetType, targetId] as const,
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

export function useCreateMaterialLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: MaterialLinkPayload) => createMaterialLink(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.all })
    },
  })
}

export function useMaterialsForTarget(
  targetType: MaterialAttachmentTarget,
  targetId: number | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: materialsKeys.forTarget(targetType, targetId ?? 0),
    queryFn: () => listMaterialsForTarget(targetType, targetId as number),
    enabled: enabled && targetId != null,
    staleTime: 30_000,
  })
}

export function useAttachMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      materialId,
      targetType,
      targetId,
    }: {
      materialId: number
      targetType: MaterialAttachmentTarget
      targetId: number
    }) => attachMaterial(materialId, targetType, targetId),
    onSuccess: (_data, { targetType, targetId }) => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.forTarget(targetType, targetId) })
    },
  })
}

export function useDetachMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      materialId,
      targetType,
      targetId,
    }: {
      materialId: number
      targetType: MaterialAttachmentTarget
      targetId: number
    }) => detachMaterial(materialId, targetType, targetId),
    onSuccess: (_data, { targetType, targetId }) => {
      queryClient.invalidateQueries({ queryKey: materialsKeys.forTarget(targetType, targetId) })
    },
  })
}
