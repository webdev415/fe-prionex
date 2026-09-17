import { api } from '@/lib/api'
import type {
  Material,
  MaterialAttachment,
  MaterialAttachmentTarget,
  MaterialCallAttachment,
  MaterialCategory,
  MaterialLinkPayload,
  MaterialListFilters,
  MaterialListResponse,
  MaterialUpdatePayload,
  MaterialUploadPayload,
} from '../types/materials'

const BASE = '/api/v1/quality/materials'
const CATEGORIES_BASE = '/api/v1/quality/material-categories'
const QUALITY_BASE = '/api/v1/quality'

function buildListParams(filters: MaterialListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.category != null) params.set('category', String(filters.category))
  if (filters.type) params.set('type', filters.type)
  if (filters.q) params.set('q', filters.q)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}

export async function listMaterials(
  filters: MaterialListFilters = {}
): Promise<MaterialListResponse> {
  const response = await api.get<MaterialListResponse>(BASE, {
    params: buildListParams(filters),
  })
  return response.data
}

export async function uploadMaterial(payload: MaterialUploadPayload): Promise<Material> {
  const formData = new FormData()
  formData.append('file', payload.file)
  if (payload.title) formData.append('title', payload.title)
  if (payload.description) formData.append('description', payload.description)
  if (payload.category_id != null) formData.append('category_id', String(payload.category_id))
  if (payload.tags?.length) formData.append('tags', payload.tags.join(','))
  const response = await api.post<Material>(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  })
  return response.data
}

export async function downloadMaterial(id: number): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE}/${id}/download`, {
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

/** Fetch the file bytes for in-browser preview (inline Content-Disposition). */
export async function previewMaterial(id: number): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE}/${id}/download`, {
    params: { disposition: 'inline' },
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}

export async function updateMaterial(
  id: number,
  payload: MaterialUpdatePayload
): Promise<Material> {
  const response = await api.put<Material>(`${BASE}/${id}`, payload)
  return response.data
}

export async function archiveMaterial(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}

export async function listMaterialCategories(): Promise<MaterialCategory[]> {
  const response = await api.get<MaterialCategory[]>(CATEGORIES_BASE)
  return response.data
}

export async function createMaterialCategory(name: string): Promise<MaterialCategory> {
  const response = await api.post<MaterialCategory>(CATEGORIES_BASE, { name })
  return response.data
}

// ── Call attachments ──────────────────────────────────────────────────

export async function attachMaterialToCall(
  materialId: number,
  callId: string
): Promise<MaterialCallAttachment> {
  const response = await api.post<MaterialCallAttachment>(`${BASE}/${materialId}/attachments`, {
    call_id: callId,
  })
  return response.data
}

export async function detachMaterialFromCall(materialId: number, callId: string): Promise<void> {
  await api.delete(`${BASE}/${materialId}/attachments/${callId}`)
}

export async function listMaterialsForCall(callId: string): Promise<MaterialListResponse> {
  const response = await api.get<MaterialListResponse>(`${QUALITY_BASE}/calls/${callId}/materials`)
  return response.data
}

export async function listCallsForMaterial(materialId: number): Promise<MaterialCallAttachment[]> {
  const response = await api.get<MaterialCallAttachment[]>(`${BASE}/${materialId}/attachments`)
  return response.data
}

/** Register a link as a library material.

 *  A separate endpoint from `uploadMaterial`: that one is multipart and built
 *  around a File, and a body that is sometimes a form and sometimes JSON is
 *  worse than two endpoints. The url is validated server-side too — this is a
 *  convenience, not the control.
 */
export async function createMaterialLink(payload: MaterialLinkPayload): Promise<Material> {
  const response = await api.post<Material>(`${BASE}/link`, payload)
  return response.data
}

const ATTACH_BASE = '/api/v1/quality/material-attachments'

export async function attachMaterial(
  materialId: number,
  targetType: MaterialAttachmentTarget,
  targetId: number
): Promise<MaterialAttachment> {
  const response = await api.post<MaterialAttachment>(ATTACH_BASE, {
    material_id: materialId,
    target_type: targetType,
    target_id: targetId,
  })
  return response.data
}

export async function detachMaterial(
  materialId: number,
  targetType: MaterialAttachmentTarget,
  targetId: number
): Promise<void> {
  await api.delete(`${ATTACH_BASE}/${materialId}/${targetType}/${targetId}`)
}

export async function listMaterialsForTarget(
  targetType: MaterialAttachmentTarget,
  targetId: number
): Promise<MaterialListResponse> {
  const response = await api.get<MaterialListResponse>(ATTACH_BASE, {
    params: { target_type: targetType, target_id: targetId },
  })
  return response.data
}
