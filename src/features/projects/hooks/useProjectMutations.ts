/**
 * Project Mutation Hooks
 *
 * React Query mutation hooks for project CRUD operations.
 * Updated: 2025-12-08 - Added export hook
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '../api/projectsApi'
import { projectsKeys } from './useProjects'
import type { CreateProjectInput, UpdateProjectInput, ExportParams } from '../types'

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
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectInput }) =>
      projectsApi.updateProject(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    },
  })
}

/**
 * Hook to export projects to CSV or XLSX
 */
export function useProjectExport() {
  return useMutation({
    mutationFn: (params: ExportParams) => projectsApi.exportProjects(params),
    onSuccess: (blob, variables) => {
      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `projects_export_${new Date().toISOString().split('T')[0]}.${variables.format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
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
