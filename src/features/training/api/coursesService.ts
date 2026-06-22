import { api } from '@/lib/api'
import type {
  CourseCardData,
  CourseCreatePayload,
  CourseListFilters,
  CourseListResponse,
  CourseUpdatePayload,
  EnrollResponse,
  LessonCompletionResponse,
} from '../types/courses'

const BASE = '/api/v1/quality/courses'

function buildListParams(filters: CourseListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}

export async function listCourses(filters: CourseListFilters = {}): Promise<CourseListResponse> {
  const response = await api.get<CourseListResponse>(BASE, {
    params: buildListParams(filters),
  })
  return response.data
}

export async function getCourse(id: number): Promise<CourseCardData> {
  const response = await api.get<CourseCardData>(`${BASE}/${id}`)
  return response.data
}

export async function createCourse(payload: CourseCreatePayload): Promise<CourseCardData> {
  const response = await api.post<CourseCardData>(BASE, payload)
  return response.data
}

export async function updateCourse(
  id: number,
  payload: CourseUpdatePayload
): Promise<CourseCardData> {
  const response = await api.put<CourseCardData>(`${BASE}/${id}`, payload)
  return response.data
}

export async function archiveCourse(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}

export async function enrollOperators(
  courseId: number,
  operatorIds: number[]
): Promise<EnrollResponse> {
  const response = await api.post<EnrollResponse>(`${BASE}/${courseId}/enroll`, {
    operator_ids: operatorIds,
  })
  return response.data
}

export async function completeLesson(
  enrollmentId: number,
  lessonId: number
): Promise<LessonCompletionResponse> {
  const response = await api.post<LessonCompletionResponse>(
    `${BASE}/enrollments/${enrollmentId}/lessons/${lessonId}/complete`
  )
  return response.data
}

export async function exportCourses(filters: CourseListFilters = {}): Promise<Blob> {
  const response = await api.get<Blob>(`${BASE}/export`, {
    params: buildListParams(filters),
    responseType: 'blob',
    timeout: 120_000,
  })
  return response.data
}
