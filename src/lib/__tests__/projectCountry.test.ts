/**
 * The narrow "is the active project Ukrainian" check (story 17-56, Р-1/Р-3).
 *
 * UBKI is a Ukrainian-only integration. The shared `Country` type folds every
 * code except 'ES' into 'UA', so a Canadian project looked Ukrainian to every
 * UBKI gate. The new check reads the raw code instead — and the shared type
 * stays as it was (P-8), since widening it would move phone formats, tax-id
 * checks and messaging channels too.
 */
import { describe, expect, it } from 'vitest'
import { activeProjectCountry, activeProjectIsUkrainian } from '../projectCountry'

type ProjectUser = NonNullable<Parameters<typeof activeProjectIsUkrainian>[0]>

function userIn(projectCountry: string | undefined, fromMe?: string): ProjectUser {
  return {
    active_project_id: '2',
    active_project_country: fromMe,
    projects: [{ id: '2', country: projectCountry }],
  }
}

describe('activeProjectIsUkrainian', () => {
  it('P-1: a UA project is Ukrainian', () => {
    expect(activeProjectIsUkrainian(userIn('UA'))).toBe(true)
  })

  it('P-2: a CA project is not Ukrainian', () => {
    expect(activeProjectIsUkrainian(userIn('CA'))).toBe(false)
  })

  it('P-3: an ES project is not Ukrainian', () => {
    expect(activeProjectIsUkrainian(userIn('ES'))).toBe(false)
  })

  it('P-4: an unknown country code is not Ukrainian', () => {
    expect(activeProjectIsUkrainian(userIn('PL'))).toBe(false)
  })

  it('P-5: no country code anywhere, or no user at all, reads as Ukrainian', () => {
    expect(activeProjectIsUkrainian(userIn(undefined))).toBe(true)
    expect(activeProjectIsUkrainian(null)).toBe(true)
  })

  it('P-6: a project without a code falls back to the country from /me', () => {
    expect(activeProjectIsUkrainian(userIn(undefined, 'CA'))).toBe(false)
  })

  it("P-7: the project's own code wins over the country from /me", () => {
    expect(activeProjectIsUkrainian(userIn('UA', 'CA'))).toBe(true)
  })

  it('P-8: the shared country type is not widened — a CA project still folds to UA', () => {
    expect(activeProjectCountry(userIn('CA'))).toBe('UA')
  })

  // The live acceptance account works in two projects: 1 (UA) and 3 (CA). The
  // check must read the active one, not the first one or "any Ukrainian one".
  const ukrainianAndCanadian = [
    { id: '1', country: 'UA' },
    { id: '3', country: 'CA' },
  ]

  it('P-9: the active Canadian project of a user who also works in a Ukrainian one is not Ukrainian', () => {
    expect(
      activeProjectIsUkrainian({ active_project_id: '3', projects: ukrainianAndCanadian })
    ).toBe(false)
  })

  it('P-10: the active Ukrainian project of a user who also works in a Canadian one is Ukrainian', () => {
    expect(
      activeProjectIsUkrainian({ active_project_id: '1', projects: ukrainianAndCanadian })
    ).toBe(true)
  })
})
