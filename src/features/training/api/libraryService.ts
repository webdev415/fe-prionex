import { api } from '@/lib/api'
import type {
  LibraryCallCard,
  LibraryCallCreatePayload,
  LibraryCallListFilters,
  LibraryCallListResponse,
  LibraryCallUpdatePayload,
  LibraryHelpfulToggleResponse,
  LibraryTagsResponse,
} from '../types/library'

const BASE = '/api/v1/quality/library'

function buildListParams(filters: LibraryCallListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  filters.tag?.forEach((t) => params.append('tag', t))
  if (filters.q) params.set('q', filters.q)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}

export async function listLibraryCalls(
  filters: LibraryCallListFilters = {}
): Promise<LibraryCallListResponse> {
  const response = await api.get<LibraryCallListResponse>(BASE, {
    params: buildListParams(filters),
  })
  return response.data
}

export async function listLibraryTags(): Promise<string[]> {
  const response = await api.get<LibraryTagsResponse>(`${BASE}/tags`)
  return response.data.tags
}

export async function getLibraryCall(id: number): Promise<LibraryCallCard> {
  const response = await api.get<LibraryCallCard>(`${BASE}/${id}`)
  return response.data
}

export async function createLibraryCall(
  payload: LibraryCallCreatePayload
): Promise<LibraryCallCard> {
  const response = await api.post<LibraryCallCard>(BASE, payload)
  return response.data
}

export async function updateLibraryCall(
  id: number,
  payload: LibraryCallUpdatePayload
): Promise<LibraryCallCard> {
  const response = await api.put<LibraryCallCard>(`${BASE}/${id}`, payload)
  return response.data
}

export async function archiveLibraryCall(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}

export async function toggleLibraryHelpful(id: number): Promise<LibraryHelpfulToggleResponse> {
  const response = await api.post<LibraryHelpfulToggleResponse>(`${BASE}/${id}/helpful`)
  return response.data
}

export async function bumpLibraryView(id: number): Promise<number> {
  const response = await api.post<{ view_count: number }>(`${BASE}/${id}/view`)
  return response.data.view_count
}
