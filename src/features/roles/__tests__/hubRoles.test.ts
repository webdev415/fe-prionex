import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/common.json'
import es from '@/../public/locales/es/common.json'
import uk from '@/../public/locales/uk/common.json'
import {
  HUB_ROLE_NOT_SET,
  HUB_ROLE_OPTIONS,
  describeHubRole,
  effectiveHubRoleValue,
  hasHubRoleField,
  hubRoleCatalogView,
  hubRoleChoices,
  hubRoleLabel,
  hubRoleLock,
  isAssignableHubRole,
  isStaleHubCatalogueRefusal,
} from '../hubRoles'
import type { HubRoleCatalog } from '../types'

function lookup(locale: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      locale
    )
}

const catalog = (overrides: Partial<HubRoleCatalog> = {}): HubRoleCatalog => ({
  mode: 'on',
  enabled: true,
  options: [
    { code: 'none', assignable: true },
    { code: 'employee', assignable: true },
    { code: 'operator', assignable: true },
    { code: 'admin', assignable: false },
  ],
  ...overrides,
})

const answered = (data: unknown) =>
  hubRoleCatalogView({ isPending: false, isError: false, data: data as HubRoleCatalog })

describe('HUB chat role labels', () => {
  it('names the eight catalogue codes of the backend default, "none" included', () => {
    expect(HUB_ROLE_OPTIONS.map((option) => option.value)).toEqual([
      'none',
      'employee',
      'training_workspace',
      'quality_workspace',
      'lawyer',
      'operator',
      'supervisor',
      'admin',
    ])
  })

  /*
   * The whole point of the labels: "none" means no HUB at all, "employee" is
   * the minimal rights, and the EMPTY value is neither - HUB goes by the role
   * name there. Reading "not set" as "minimal rights" is the lie this pins.
   */
  it('says in Ukrainian what each kind of value really does', () => {
    expect(lookup(uk, 'pages.roles.hubRole.options.none')).toBe('Без доступу до HUB')
    expect(lookup(uk, 'pages.roles.hubRole.options.employee')).toBe(
      'Співробітник (мінімальні права)'
    )
    expect(lookup(uk, HUB_ROLE_NOT_SET.labelKey)).toBe('Не задано — за назвою ролі')
    expect(String(lookup(uk, HUB_ROLE_NOT_SET.labelKey))).not.toMatch(/мінімальн/i)
    expect(lookup(uk, 'pages.roles.forms.hubRole')).toBe('Роль у чаті (HUB)')
    expect(lookup(uk, 'pages.roles.forms.hubRoleHint')).toBe(
      'Не задано: HUB визначає права за назвою ролі; якщо назва HUB невідома — мінімальні права (співробітник). Зміни діють у HUB протягом ~6 хв без повторного входу'
    )
  })

  it.each([
    ['uk', uk],
    ['en', en],
    ['es', es],
  ])('has every label and form text in %s', (_language, locale) => {
    const keys = [
      ...HUB_ROLE_OPTIONS.map((option) => option.labelKey),
      HUB_ROLE_NOT_SET.labelKey,
      'pages.roles.forms.hubRole',
      'pages.roles.forms.hubRoleHint',
      'pages.roles.forms.hubRoleUnavailableOption',
      'pages.roles.forms.hubRoleCatalogUnavailable',
      'pages.roles.forms.hubRoleLockedDefault',
      'pages.roles.forms.hubRoleLockedNotAssignable',
    ]
    const missing = keys.filter((key) => {
      const value = lookup(locale, key)
      return typeof value !== 'string' || value.trim() === ''
    })

    expect(missing).toEqual([])
    expect(lookup(locale, 'pages.roles.forms.hubRoleUnavailableOption')).toContain('{{code}}')
  })

  it('has an English fallback for every label and no label for an unknown code', () => {
    for (const option of HUB_ROLE_OPTIONS) {
      expect(hubRoleLabel(option.value)?.fallback).toBeTruthy()
    }
    expect(hubRoleLabel('accountant')).toBeNull()
  })
})

describe('reading the catalogue', () => {
  it('is enabled only when the backend says so, with the options it sends', () => {
    expect(answered(catalog())).toEqual({
      status: 'enabled',
      mode: 'on',
      options: catalog().options,
    })
  })

  it('treats enabled=false as switched off and offers nothing', () => {
    expect(answered(catalog({ mode: 'emit', enabled: false }))).toEqual({
      status: 'disabled',
      mode: 'emit',
      options: [],
    })
  })

  it('treats a failed request as unavailable', () => {
    expect(hubRoleCatalogView({ isPending: false, isError: true, data: undefined }).status).toBe(
      'unavailable'
    )
  })

  it('offers nothing while the answer is still on its way', () => {
    expect(hubRoleCatalogView({ isPending: true, isError: false, data: undefined })).toEqual({
      status: 'loading',
      mode: null,
      options: [],
    })
  })

  it.each([
    ['no body', null],
    ['a string', 'enabled'],
    ['no enabled flag', { mode: 'on', options: [] }],
    ['a truthy non-boolean flag', { mode: 'on', enabled: 'true', options: [] }],
    ['no option list', { mode: 'on', enabled: true }],
  ])('fails closed on a malformed answer (%s)', (_case, data) => {
    expect(answered(data).status).toBe('unavailable')
  })

  it('drops options with a bad code and keeps a missing assignable non-assignable', () => {
    const view = answered({
      mode: 'on',
      enabled: true,
      options: [
        { code: 'operator', assignable: true },
        { code: 'Operator', assignable: true },
        { code: '', assignable: true },
        { code: 'lawyer' },
        { code: 'operator', assignable: false },
        null,
      ],
    })

    expect(view.options).toEqual([
      { code: 'operator', assignable: true },
      { code: 'lawyer', assignable: false },
    ])
  })
})

describe('the choices of the select', () => {
  const options = catalog().options

  it('follows the catalogue and disables what the caller may not grant', () => {
    expect(hubRoleChoices(options, null).map((c) => [c.code, c.disabled])).toEqual([
      ['none', false],
      ['employee', false],
      ['operator', false],
      ['admin', true],
    ])
  })

  it('keeps a stored value the catalogue no longer offers, as unavailable', () => {
    const choices = hubRoleChoices(options, 'quality_workspace')

    expect(choices.at(-1)).toEqual({
      code: 'quality_workspace',
      label: null,
      disabled: true,
      unavailable: true,
    })
    expect(choices).toHaveLength(options.length + 1)
  })

  it('adds nothing for an empty or an offered stored value', () => {
    expect(hubRoleChoices(options, '')).toHaveLength(options.length)
    expect(hubRoleChoices(options, 'operator')).toHaveLength(options.length)
  })
})

describe('when the value cannot be changed', () => {
  const options = catalog().options

  it('locks every default role', () => {
    expect(hubRoleLock(options, 'operator', true)).toBe('default')
    expect(hubRoleLock(options, null, true)).toBe('default')
  })

  it('locks a stored value the caller may not grant, since it may not be taken away either', () => {
    expect(hubRoleLock(options, 'admin', false)).toBe('notAssignable')
  })

  /*
   * No lock follows from the role's NAME: what an unset value means for a
   * role named admin/administrator is the backend's rule, and its refusal
   * (HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN) is said in words instead. The form
   * test "leaves a role named Administrator open" holds the screen to that.
   */
  it('leaves everything else open, an unset value included', () => {
    expect(hubRoleLock(options, 'operator', false)).toBeNull()
    expect(hubRoleLock(options, null, false)).toBeNull()
    expect(hubRoleLock(options, '', false)).toBeNull()
    expect(hubRoleLock(options, 'retired_code', false)).toBeNull()
  })
})

/*
 * What the select shows is what a save may send, so it is derived from the
 * catalogue of NOW: a refetch under an open form can drop a picked code or
 * take `assignable` away, and a pick kept past that would be shown as the
 * first option while the stale code was sent again.
 */
describe('the value the select shows', () => {
  const options = catalog().options
  const withoutOperator = options.filter((option) => option.code !== 'operator')
  const value = (
    stored: string | null | undefined,
    pick: string | null,
    overrides: Partial<Parameters<typeof effectiveHubRoleValue>[0]> = {}
  ) => effectiveHubRoleValue({ options, stored, pick, lock: null, ...overrides })

  it('is the stored value until somebody picks one', () => {
    expect(value('operator', null)).toBe('operator')
    expect(value(null, null)).toBe('')
    expect(value(undefined, null)).toBe('')
    expect(value('retired_code', null)).toBe('retired_code')
  })

  it('is the pick while the catalogue offers it as assignable', () => {
    expect(value(null, 'operator')).toBe('operator')
    expect(value('operator', 'employee')).toBe('employee')
  })

  it('is "not set" when somebody cleared it', () => {
    expect(value('operator', '')).toBe('')
  })

  it('falls back to the stored value when the catalogue no longer offers the pick', () => {
    expect(value('employee', 'operator', { options: withoutOperator })).toBe('employee')
    expect(value(null, 'operator', { options: withoutOperator })).toBe('')
  })

  it('falls back to the stored value when the pick is no longer assignable', () => {
    expect(value(null, 'admin')).toBe('')
    expect(value('operator', 'admin')).toBe('operator')
  })

  it('is the stored value whatever the pick while the value is locked', () => {
    expect(value('admin', '', { lock: 'notAssignable' })).toBe('admin')
    expect(value('operator', 'employee', { lock: 'default' })).toBe('operator')
  })

  it('offers only what the catalogue marks assignable', () => {
    expect(isAssignableHubRole(options, 'operator')).toBe(true)
    expect(isAssignableHubRole(options, 'admin')).toBe(false)
    expect(isAssignableHubRole(options, 'lawyer')).toBe(false)
    expect(isAssignableHubRole(options, '')).toBe(false)
  })
})

describe('describing a stored value', () => {
  it('says "not set" for an empty value whatever the catalogue', () => {
    expect(describeHubRole(null, 'enabled')).toEqual({ kind: 'notSet' })
    expect(describeHubRole('', 'unavailable')).toEqual({ kind: 'notSet' })
  })

  it('names a known code while the catalogue is enabled', () => {
    expect(describeHubRole('none', 'enabled')).toEqual({
      kind: 'known',
      code: 'none',
      label: { labelKey: 'pages.roles.hubRole.options.none', fallback: 'No HUB access' },
    })
  })

  it('shows the raw code with a note when the catalogue is off or unreachable', () => {
    expect(describeHubRole('operator', 'disabled')).toEqual({
      kind: 'raw',
      code: 'operator',
      catalogUnavailable: true,
    })
    expect(describeHubRole('operator', 'unavailable')).toEqual({
      kind: 'raw',
      code: 'operator',
      catalogUnavailable: true,
    })
  })

  it('shows the raw code without a note while loading or for a code it cannot name', () => {
    expect(describeHubRole('operator', 'loading')).toEqual({
      kind: 'raw',
      code: 'operator',
      catalogUnavailable: false,
    })
    expect(describeHubRole('accountant', 'enabled')).toEqual({
      kind: 'raw',
      code: 'accountant',
      catalogUnavailable: false,
    })
  })

  it('knows a backend without the field by the missing key, not by its value', () => {
    expect(hasHubRoleField({ id: 1, hub_role: null })).toBe(true)
    expect(hasHubRoleField({ id: 1 })).toBe(false)
  })
})

describe('a refused role save that means the catalogue was out of date', () => {
  const refusal = (data: unknown) =>
    Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 422, data },
    })

  it.each([
    'HUB_ROLE_DISABLED',
    'HUB_ROLE_UNKNOWN',
    'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
    'HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING',
  ])('%s sends the form back to the catalogue', (code) => {
    expect(isStaleHubCatalogueRefusal(refusal({ detail: 'x', code }))).toBe(true)
  })

  it.each([
    ['a default role', { detail: 'x', code: 'HUB_ROLE_DEFAULT_LOCKED' }],
    ['the name alias guard', { detail: 'x', code: 'HUB_ADMIN_ALIAS_REQUIRES_HUB_ADMIN' }],
    ['the project scope', { detail: 'x', code: 'PROJECT_SCOPE_DENIED' }],
    ['an uncoded refusal', { detail: 'x' }],
    ['no body', undefined],
  ])('%s does not', (_case, data) => {
    expect(isStaleHubCatalogueRefusal(refusal(data))).toBe(false)
  })

  it('a failure that is not an HTTP answer does not', () => {
    expect(isStaleHubCatalogueRefusal(new Error('boom'))).toBe(false)
    expect(isStaleHubCatalogueRefusal(null)).toBe(false)
  })
})
