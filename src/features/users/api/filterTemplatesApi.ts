import api from '@/lib/api'
import type {
  FilterTemplate,
  FilterTemplateListResponse,
  SaveFilterTemplateInput,
  UpdateFilterTemplateInput,
} from '../types'

const BASE_URL = '/api/v1/users/me/filter-templates'

export async function getFilterTemplates(): Promise<FilterTemplateListResponse> {
  const response = await api.get<FilterTemplateListResponse>(BASE_URL)
  return response.data
}

export async function saveFilterTemplate(input: SaveFilterTemplateInput): Promise<FilterTemplate> {
  const response = await api.post<FilterTemplate>(BASE_URL, input)
  return response.data
}

export async function updateFilterTemplate(
  templateId: number,
  input: UpdateFilterTemplateInput
): Promise<FilterTemplate> {
  const response = await api.patch<FilterTemplate>(`${BASE_URL}/${templateId}`, input)
  return response.data
}

export async function deleteFilterTemplate(templateId: number): Promise<void> {
  await api.delete(`${BASE_URL}/${templateId}`)
}
