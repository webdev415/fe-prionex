/**
 * Projects API
 *
 * API functions for project CRUD operations.
 */

import api from '@/lib/api'
import type {
  ProjectListResponse,
  ProjectListParams,
  ProjectDetailResponse,
  CreateProjectInput,
  UpdateProjectInput,
} from '../types'

/**
 * Fetch paginated list of projects
 */
export async function getProjects(params: ProjectListParams = {}): Promise<ProjectListResponse> {
  const response = await api.get<ProjectListResponse>('/api/v1/projects', { params })
  return response.data
}

/**
 * Fetch a single project by ID
 */
export async function getProject(projectId: number): Promise<ProjectDetailResponse> {
  const response = await api.get<ProjectDetailResponse>(`/api/v1/projects/${projectId}`)
  return response.data
}

/**
 * Create a new project
 */
export async function createProject(data: CreateProjectInput): Promise<ProjectDetailResponse> {
  const response = await api.post<ProjectDetailResponse>('/api/v1/projects', data)
  return response.data
}

/**
 * Update an existing project
 */
export async function updateProject(
  projectId: number,
  data: UpdateProjectInput
): Promise<ProjectDetailResponse> {
  const response = await api.put<ProjectDetailResponse>(`/api/v1/projects/${projectId}`, data)
  return response.data
}

/**
 * Archive a project
 */
export async function archiveProject(projectId: number): Promise<ProjectDetailResponse> {
  const response = await api.post<ProjectDetailResponse>(`/api/v1/projects/${projectId}/archive`)
  return response.data
}

/**
 * Restore an archived project
 */
export async function restoreProject(projectId: number): Promise<ProjectDetailResponse> {
  const response = await api.post<ProjectDetailResponse>(`/api/v1/projects/${projectId}/restore`)
  return response.data
}

/**
 * Delete a project (hard delete)
 */
export async function deleteProject(projectId: number): Promise<void> {
  await api.delete(`/api/v1/projects/${projectId}`)
}

/**
 * Export projects to CSV or XLSX
 */
export async function exportProjects(params: {
  format: 'csv' | 'xlsx'
  search?: string
  status?: string
  client_company?: string
}): Promise<Blob> {
  const response = await api.get('/api/v1/projects/export', {
    params,
    responseType: 'blob',
  })
  return response.data
}

export const projectsApi = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  exportProjects,
}
