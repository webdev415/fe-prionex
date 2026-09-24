export type Country = 'UA' | 'ES'

let active: Country = 'UA'

export function setActiveCountry(country: string | null | undefined): void {
  active = country === 'ES' ? 'ES' : 'UA'
}

export function activeCountry(): Country {
  return active
}

export function activeProjectCountry(
  user:
    | {
        active_project_id?: string | null
        active_project_country?: string
        projects?: Array<{ id: string; country?: string }>
      }
    | null
    | undefined
): Country {
  const project = user?.projects?.find((p) => p.id === user.active_project_id)
  return (project?.country ?? user?.active_project_country) === 'ES' ? 'ES' : 'UA'
}
