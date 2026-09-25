import { describe, expect, it } from 'vitest'
import { hubRoleCreatePatch, hubRoleUpdatePatch } from '../buildRolePayload'
import type { HubRoleCatalogStatus } from '../hubRoles'
import type { HubRoleOption } from '../types'

const OFF: HubRoleCatalogStatus[] = ['loading', 'disabled', 'unavailable']

/** The catalogue as a caller who is not a HUB admin reads it. */
const OPTIONS: HubRoleOption[] = [
  { code: 'none', assignable: true },
  { code: 'employee', assignable: true },
  { code: 'lawyer', assignable: true },
  { code: 'operator', assignable: true },
  { code: 'supervisor', assignable: true },
  { code: 'admin', assignable: false },
]

/** The same catalogue after HUB_ROLE_CHOICES dropped `lawyer`. */
const WITHOUT_LAWYER = OPTIONS.filter((option) => option.code !== 'lawyer')

describe('hub_role on create', () => {
  it('sends the chosen value while the catalogue is enabled', () => {
    expect(hubRoleCreatePatch('enabled', 'operator', OPTIONS)).toEqual({ hub_role: 'operator' })
    expect(hubRoleCreatePatch('enabled', 'none', OPTIONS)).toEqual({ hub_role: 'none' })
  })

  it('sends no key for "not set" - never an implicit null', () => {
    expect(Object.keys(hubRoleCreatePatch('enabled', '', OPTIONS))).toEqual([])
  })

  it.each(OFF)('sends no key at all while the catalogue is %s', (status) => {
    expect(Object.keys(hubRoleCreatePatch(status, 'operator', OPTIONS))).toEqual([])
    expect(Object.keys(hubRoleCreatePatch(status, '', OPTIONS))).toEqual([])
  })

  /*
   * The select can only offer what the catalogue offers; the builder holds the
   * same line, so a pick the current catalogue dropped (HUB_ROLE_UNKNOWN) or
   * no longer lets the caller grant is never sent, whatever a form passes in.
   */
  it('never sends a code the current catalogue does not offer as assignable', () => {
    expect(Object.keys(hubRoleCreatePatch('enabled', 'lawyer', WITHOUT_LAWYER))).toEqual([])
    expect(Object.keys(hubRoleCreatePatch('enabled', 'admin', OPTIONS))).toEqual([])
    expect(Object.keys(hubRoleCreatePatch('enabled', 'operator', []))).toEqual([])
  })
})

describe('hub_role on edit', () => {
  const patch = (
    stored: string | null | undefined,
    selected: string,
    overrides: Partial<Parameters<typeof hubRoleUpdatePatch>[0]> = {}
  ) =>
    hubRoleUpdatePatch({
      status: 'enabled',
      lock: null,
      stored,
      selected,
      options: OPTIONS,
      ...overrides,
    })

  it('sends nothing when the value did not change', () => {
    expect(Object.keys(patch('operator', 'operator'))).toEqual([])
    expect(Object.keys(patch(null, ''))).toEqual([])
    expect(Object.keys(patch(undefined, ''))).toEqual([])
  })

  it('sends the new value when it changed', () => {
    expect(patch('operator', 'supervisor')).toEqual({ hub_role: 'supervisor' })
    expect(patch(null, 'none')).toEqual({ hub_role: 'none' })
  })

  it('sends an explicit null only when a stored value was cleared', () => {
    expect(patch('operator', '')).toEqual({ hub_role: null })
  })

  it('never sends a locked value, whatever the select holds', () => {
    expect(Object.keys(patch('admin', 'operator', { lock: 'default' }))).toEqual([])
    expect(Object.keys(patch('admin', '', { lock: 'notAssignable' }))).toEqual([])
  })

  it.each(OFF)('sends no key at all while the catalogue is %s', (status) => {
    expect(Object.keys(patch('operator', '', { status }))).toEqual([])
    expect(Object.keys(patch(null, 'operator', { status }))).toEqual([])
  })

  it('never sends a code the current catalogue does not offer as assignable', () => {
    expect(Object.keys(patch('operator', 'lawyer', { options: WITHOUT_LAWYER }))).toEqual([])
    expect(Object.keys(patch(null, 'admin'))).toEqual([])
  })

  /*
   * "Not set" is not a catalogue code: clearing a stored value the catalogue
   * no longer offers is an explicit action and still goes out as null.
   */
  it('still clears a stored value the catalogue no longer offers', () => {
    expect(patch('lawyer', '', { options: WITHOUT_LAWYER })).toEqual({ hub_role: null })
  })
})
