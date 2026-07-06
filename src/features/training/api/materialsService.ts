import { api } from '@/lib/api'
import type {
  Material,
  MaterialCategory,
  MaterialListFilters,
  MaterialListResponse,
  MaterialUpdatePayload,
  MaterialUploadPayload,
} from '../types/materials'

const BASE = '/api/v1/quality/materials'
const CATEGORIES_BASE = '/api/v1/quality/material-categories'

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
