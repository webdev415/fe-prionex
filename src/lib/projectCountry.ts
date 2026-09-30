/**
 * The shared country folds every code except 'ES' into 'UA'. These gates stay
 * on that fold on purpose — story 17-56 tail, awaiting the owner's decision:
 * SMS (`useSmsServiceAvailable.ts`), the assistant and SMS templates
 * (`UkrainianProjectRoute.tsx`), phone formats (`phone.ts`) and the assistant
 * menu item (`DashboardLayout.tsx:82`). Only UBKI reads the raw code, through
 * `activeProjectIsUkrainian`.
 */
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
  return activeProjectCode(user) === 'ES' ? 'ES' : 'UA'
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
  const code = activeProjectCode(user)
  return !code || code === 'UA'
}

/** The raw country code of the active project: its own, else the one from /me. */
function activeProjectCode(user: Parameters<typeof activeProjectCountry>[0]): string | undefined {
  const project = user?.projects?.find((p) => p.id === user.active_project_id)
  return project?.country ?? user?.active_project_country
}
