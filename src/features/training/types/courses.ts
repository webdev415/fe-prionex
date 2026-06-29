/** Types for the Courses surface (KAN-750). Mirror the quality-service schemas. */

export type CourseStatus = 'draft' | 'published' | 'archived'
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'
export type LessonContentType = 'text' | 'video_link' | 'library_call'
export type MaterialType = 'pdf' | 'docx' | 'video' | 'audio' | 'link'
export type EnrollmentStatus = 'in_progress' | 'completed'

export interface CourseMaterial {
  type: MaterialType
  name: string
  url?: string | null
}

export interface LessonCard {
  id: number
  ordinal: number
  title: string
  content_type: LessonContentType
  content_payload?: Record<string, unknown> | null
}

export interface CourseCardData {
  id: number
  project_id: number
  title: string
  description?: string | null
  status: CourseStatus
  category?: string | null
  level: CourseLevel
  author_name?: string | null
  duration_minutes?: number | null
  materials: CourseMaterial[]
  created_by_user_id: number
  lesson_count: number
  enrolled_count: number
  avg_completion_pct: number
  created_at: string
  updated_at: string
  lessons: LessonCard[]
}

export interface CourseListResponse {
  data: CourseCardData[]
  total: number
}

export interface CourseListFilters {
  status?: CourseStatus
  q?: string
  limit?: number
  offset?: number
}

export interface LessonPayload {
  id?: number
  ordinal: number
  title: string
  content_type: LessonContentType
  content_payload?: Record<string, unknown> | null
}

export interface CourseCreatePayload {
  title: string
  description?: string | null
  status?: CourseStatus
  category?: string | null
  level?: CourseLevel
  author_name?: string | null
  duration_minutes?: number | null
  materials?: CourseMaterial[]
  lessons?: LessonPayload[]
}

export interface CourseUpdatePayload {
  title?: string
  description?: string | null
  status?: CourseStatus
  category?: string | null
  level?: CourseLevel
  author_name?: string | null
  duration_minutes?: number | null
  materials?: CourseMaterial[]
  lessons?: LessonPayload[]
}

export interface EnrollmentCard {
  id: number
  course_id: number
  operator_id: number
  assigned_by_user_id?: number | null
  status: EnrollmentStatus
  enrolled_at: string
  completed_at?: string | null
}

export interface EnrollResponse {
  enrollments: EnrollmentCard[]
}

export interface LessonCompletionResponse {
  enrollment_id: number
  completed_lessons: number
  total_lessons: number
  status: EnrollmentStatus
}
