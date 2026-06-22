import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveCourse,
  createCourse,
  enrollOperators,
  getCourse,
  listCourses,
  updateCourse,
} from '../api/coursesService'
import type { CourseCreatePayload, CourseListFilters, CourseUpdatePayload } from '../types/courses'

export const coursesKeys = {
  all: ['training', 'courses'] as const,
  list: (filters: CourseListFilters) => [...coursesKeys.all, 'list', filters] as const,
  detail: (id: number) => [...coursesKeys.all, 'detail', id] as const,
}

export function useCourses(filters: CourseListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: coursesKeys.list(filters),
    queryFn: () => listCourses(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useCourse(id: number, enabled = true) {
  return useQuery({
    queryKey: coursesKeys.detail(id),
    queryFn: () => getCourse(id),
    enabled,
    staleTime: 30_000,
  })
}

export function useCreateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CourseCreatePayload) => createCourse(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coursesKeys.all }),
  })
}

export function useUpdateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CourseUpdatePayload }) =>
      updateCourse(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coursesKeys.all }),
  })
}

export function useArchiveCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => archiveCourse(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coursesKeys.all }),
  })
}

export function useEnrollCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      courseId,
      operatorIds,
      startDate,
    }: {
      courseId: number
      operatorIds: number[]
      startDate?: string | null
    }) => enrollOperators(courseId, operatorIds, startDate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coursesKeys.all }),
  })
}
