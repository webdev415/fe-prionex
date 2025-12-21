/**
 * Project Helper Utilities
 *
 * Helper functions for working with projects in import context.
 */

import { projectsApi } from '@/features/projects/api/projectsApi'

/**
 * Get project ID from project code
 *
 * Fetches projects from API and finds the one with matching code.
 */
export async function getProjectIdFromCode(projectCode: string): Promise<number> {
  // Fetch projects and find matching code
  // Note: Backend max page_size is 100, so we use 100 instead of 1000
  try {
    const response = await projectsApi.getProjects({ page: 1, page_size: 100 })
    const project = response.projects.find((p) => p.code === projectCode)

    if (!project) {
      throw new Error(`Project with code "${projectCode}" not found`)
    }

    return project.id
  } catch (error) {
    // Preserve original error if it's an Axios error (for 401 handling)
    if (error && typeof error === 'object' && 'response' in error) {
      // Re-throw original Axios error to preserve response structure
      throw error
    }

    // For non-Axios errors, wrap in Error
    throw new Error(
      `Failed to find project with code "${projectCode}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
