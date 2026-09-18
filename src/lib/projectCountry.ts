export type Country = 'UA' | 'ES'

export function activeProjectCountry(
  user:
    | { active_project_id?: string | null; projects?: Array<{ id: string; country?: string }> }
    | null
    | undefined
): Country {
  const project = user?.projects?.find((p) => p.id === user.active_project_id)
  return project?.country === 'ES' ? 'ES' : 'UA'
}
