/**
 * Project Mutation Hooks
 *
 * React Query mutation hooks for project CRUD operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '../api/projectsApi'
import { projectsKeys } from './useProjects'
import type { CreateProjectInput, UpdateProjectInput } from '../types'

/**
 * Hook to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProjectInput) => projectsApi.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    },
  })
}

/**
 * Hook to update an existing project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: UpdateProjectInput }) =>
      projectsApi.updateProject(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    },
  })
}

/**
 * Hook to archive a project
 */
export function useArchiveProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId }: { projectId: number }) => projectsApi.archiveProject(projectId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    },
  })
}

/**
 * Hook to restore an archived project
 */
export function useRestoreProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId }: { projectId: number }) => projectsApi.restoreProject(projectId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    },
  })
}

/**
 * Hook to delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId }: { projectId: number }) => projectsApi.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    },
  })
}
