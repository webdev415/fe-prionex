import type { ApiUser, ProjectRole } from '@/features/users/types'

export const ALL_PROJECTS = 0

export function membershipsForProject(user: ApiUser, projectId: number): ProjectRole[] {
  const memberships = user.projects ?? []
  if (projectId === ALL_PROJECTS) return memberships
  return memberships.filter((membership) => membership.project_id === projectId)
}

function distinct(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) seen.add(trimmed)
  }
  return [...seen]
}

export function positionsOf(user: ApiUser, projectId: number): string[] {
  return distinct(membershipsForProject(user, projectId).map((m) => m.role_name))
}

export function departmentsOf(user: ApiUser, projectId: number): string[] {
  return distinct(membershipsForProject(user, projectId).map((m) => m.department_name))
}
