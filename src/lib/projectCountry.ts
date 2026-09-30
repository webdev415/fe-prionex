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

/**
 * Whether the active project is Ukrainian by its raw country code — the gate
 * for Ukrainian-only integrations such as UBKI (story 17-56, Р-1). Unlike
 * `activeProjectCountry`, a Canadian or any other named code is not folded
 * into 'UA'; `Country` stays narrow because widening it would also move phone
 * formats, tax-id checks and messaging channels. No code at all reads as
 * Ukrainian (Р-3): auth defaults every project to 'UA', so a missing code only
 * happens on a degraded sign-in, where the main project must keep UBKI.
 */
export function activeProjectIsUkrainian(
  user: Parameters<typeof activeProjectCountry>[0]
): boolean {
  const project = user?.projects?.find((p) => p.id === user.active_project_id)
  const code = project?.country ?? user?.active_project_country
  return !code || code === 'UA'
}
