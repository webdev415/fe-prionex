/**
 * Task API Service
 * Calls task service through Kong gateway
 */

import api from '@/lib/api'
import type {
  TaskListResponse,
  TaskDetailResponse,
  TaskResponse,
  TaskSubjectResponse,
  TaskCommentResponse,
} from './types'

const BASE_URL = '/api/v1/tasks'

/**
 * List tasks for a client
 */
export async function getClientTasks(
  clientId: number,
  params: { status?: string; priority?: string; skip?: number; limit?: number } = {}
): Promise<TaskListResponse> {
  const response = await api.get<TaskListResponse>(`${BASE_URL}/client/${clientId}`, { params })
  return response.data
}

/**
 * Get a single task with comments
 */
export async function getTask(taskId: number): Promise<TaskDetailResponse> {
  const response = await api.get<TaskDetailResponse>(`${BASE_URL}/${taskId}`)
  return response.data
}

/**
 * Create a new task
 */
export async function createTask(data: {
  client_id: number
  title: string
  description?: string
  priority?: string
  due_date?: string
  subject_id?: number
  assigned_to_user_id?: number
  assigned_to_username?: string
  debt_id?: number
  reminder_date?: string
  internal_notes?: string
}): Promise<TaskResponse> {
  const response = await api.post<TaskResponse>(BASE_URL + '/', data)
  return response.data
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: number,
  data: Record<string, unknown>
): Promise<TaskResponse> {
  const response = await api.put<TaskResponse>(`${BASE_URL}/${taskId}`, data)
  return response.data
}

/**
 * Soft-delete a task
 */
export async function deleteTask(taskId: number): Promise<void> {
  await api.delete(`${BASE_URL}/${taskId}`)
}

/**
 * Add a comment to a task
 */
export async function addTaskComment(
  taskId: number,
  content: string
): Promise<TaskCommentResponse> {
  const response = await api.post<TaskCommentResponse>(`${BASE_URL}/${taskId}/comments`, {
    content,
  })
  return response.data
}

/**
 * List task subjects for dropdowns
 */
export async function getTaskSubjects(
  activeOnly = true
): Promise<{ subjects: TaskSubjectResponse[] }> {
  const response = await api.get<{ subjects: TaskSubjectResponse[] }>(`${BASE_URL}/subjects`, {
    params: { active_only: activeOnly },
  })
  return response.data
}

export const taskApi = {
  getClientTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addTaskComment,
  getTaskSubjects,
  getMyTasks,
}

/**
 * Get past tasks assigned to the current user (for bell notification)
 */
export async function getMyTasks(): Promise<TaskListResponse> {
  const response = await api.get<TaskListResponse>(`${BASE_URL}/my-tasks`)
  return response.data
}
