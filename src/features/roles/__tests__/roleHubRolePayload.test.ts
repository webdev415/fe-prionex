/**
 * What a role form adds to its request for HUB chat rights
 * (buildRolePayload.ts), for both builds of VITE_ROLE_CHAT_SETTINGS_ENABLED.
 *
 * - off (KAN-1476): the `hub_role` patches of «Роль у чаті (HUB)»;
 * - on (board #1621, story 4): the chat settings are the switches, the screen
 *   and the template, and no chat patch emits `hub_role` at all.
 */
import { describe, expect, it } from 'vitest'
import {
  chatTemplateCreatePatch,
  chatUpdatePatch,
  hubRoleCreatePatch,
  hubRoleUpdatePatch,
} from '../buildRolePayload'
import { NO_ACCESS_SWITCHES, type ChatCatalogView, type ChatDraft } from '../chatRoleSet'
import type { HubRoleCatalogStatus } from '../hubRoles'
import type { ChatSwitches, HubRoleOption } from '../types'

const OPERATOR: ChatSwitches = {
  access: true,
  client_dialogs: 'my',
  create_groups: true,
  dept_channel_admin: false,
  download_files: true,
  ai_assistant: true,
  chat_only: false,
  lead: false,
}

/** The catalogue as a caller who is not a HUB admin reads it. */
const CATALOG: ChatCatalogView = {
  status: 'ready',
  templates: [
    { code: 'admin', assignable: false },
    { code: 'supervisor', assignable: true },
    { code: 'operator', assignable: true },
    { code: 'none', assignable: true },
  ],
  homePlanes: ['operator', 'legal', 'training', 'quality', 'control', 'my_day'],
  clientDialogValues: ['none', 'my', 'department', 'all'],
}

const draft = (switches: ChatSwitches, homePlane = 'operator'): ChatDraft => ({
  switches,
  homePlane,
})

describe('the chat patches (flag on) never send hub_role', () => {
  it('no chat patch carries hub_role, whatever it is given', () => {
    const patches = [
      chatTemplateCreatePatch(CATALOG, 'operator'),
      chatTemplateCreatePatch(CATALOG, ''),
      chatUpdatePatch({
        editable: true,
        stored: OPERATOR,
        storedHomePlane: 'operator',
        draft: draft({ ...OPERATOR, lead: true }),
      }),
      chatUpdatePatch({
        editable: true,
        stored: null,
        storedHomePlane: 'my_day',
        draft: draft(NO_ACCESS_SWITCHES, 'my_day'),
      }),
    ]
    for (const patch of patches) expect(Object.keys(patch)).not.toContain('hub_role')
  })
})

describe('chat_template on create', () => {
  it('sends the chosen template while the catalogue offers it as assignable', () => {
    expect(chatTemplateCreatePatch(CATALOG, 'operator')).toEqual({ chat_template: 'operator' })
    expect(chatTemplateCreatePatch(CATALOG, 'none')).toEqual({ chat_template: 'none' })
  })

  it('sends no key when nothing was chosen - never an implicit null', () => {
    expect(Object.keys(chatTemplateCreatePatch(CATALOG, ''))).toEqual([])
  })

  it('never sends a template the current catalogue does not offer as assignable', () => {
    expect(Object.keys(chatTemplateCreatePatch(CATALOG, 'admin'))).toEqual([])
    expect(Object.keys(chatTemplateCreatePatch(CATALOG, 'lawyer'))).toEqual([])
  })

  it.each(['loading', 'unavailable'] as const)(
    'sends no key at all while the catalogue is %s',
    (status) => {
      expect(Object.keys(chatTemplateCreatePatch({ ...CATALOG, status }, 'operator'))).toEqual([])
    }
  )
})

describe('chat_switches and home_plane on edit', () => {
  const patch = (overrides: Partial<Parameters<typeof chatUpdatePatch>[0]> = {}) =>
    chatUpdatePatch({
      editable: true,
      stored: OPERATOR,
      storedHomePlane: 'operator',
      draft: null,
      ...overrides,
    })

  it('sends nothing when the section was not touched', () => {
    expect(Object.keys(patch())).toEqual([])
  })

  it('sends nothing when the values were changed and changed back', () => {
    expect(Object.keys(patch({ draft: draft({ ...OPERATOR }) }))).toEqual([])
  })

  /*
   * A field nobody changed is not sent back: a form that was not refetched
   * would otherwise undo what somebody else saved in it meanwhile.
   */
  it('sends all eight switches, in form order, and not the screen when only a switch changed', () => {
    const body = patch({ draft: draft({ ...OPERATOR, client_dialogs: 'department' }) })

    expect(body).toEqual({ chat_switches: { ...OPERATOR, client_dialogs: 'department' } })
    expect(Object.keys(body.chat_switches ?? {})).toEqual([
      'access',
      'client_dialogs',
      'create_groups',
      'dept_channel_admin',
      'download_files',
      'ai_assistant',
      'chat_only',
      'lead',
    ])
  })

  it('sends only the screen when only the screen changed', () => {
    expect(patch({ draft: draft(OPERATOR, 'my_day') })).toEqual({ home_plane: 'my_day' })
  })

  it('sends both when a switch and the screen changed', () => {
    expect(patch({ draft: draft({ ...OPERATOR, lead: true }, 'control') })).toEqual({
      chat_switches: { ...OPERATOR, lead: true },
      home_plane: 'control',
    })
  })

  it('fills a role that is not filled with the switches, even the starting ones, and keeps its screen', () => {
    expect(
      patch({ stored: null, storedHomePlane: 'my_day', draft: draft(NO_ACCESS_SWITCHES, 'my_day') })
    ).toEqual({ chat_switches: NO_ACCESS_SWITCHES })
  })

  it('fills a role that is not filled with the screen too when the screen changed', () => {
    expect(
      patch({ stored: null, storedHomePlane: 'my_day', draft: draft(NO_ACCESS_SWITCHES, 'legal') })
    ).toEqual({ chat_switches: NO_ACCESS_SWITCHES, home_plane: 'legal' })
  })

  it('sends nothing for a role that is not filled unless somebody fills it', () => {
    expect(Object.keys(patch({ stored: null, draft: null }))).toEqual([])
  })

  it('sends nothing from a section that may not be edited, whatever it holds', () => {
    expect(
      Object.keys(patch({ editable: false, draft: draft({ ...OPERATOR, lead: true }) }))
    ).toEqual([])
  })

  it('never sends chat_template on edit', () => {
    expect(Object.keys(patch({ draft: draft({ ...OPERATOR, lead: true }) }))).not.toContain(
      'chat_template'
    )
  })
})

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

describe('hub_role on create (flag off)', () => {
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

describe('hub_role on edit (flag off)', () => {
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
