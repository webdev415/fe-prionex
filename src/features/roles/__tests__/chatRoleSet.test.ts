import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/common.json'
import es from '@/../public/locales/es/common.json'
import uk from '@/../public/locales/uk/common.json'
import {
  CHAT_ACCESS_LABELS,
  NAMED_CHAT_TEMPLATES,
  NAMED_CLIENT_DIALOGS,
  NAMED_HOME_PLANES,
  NO_ACCESS_SWITCHES,
  SWITCH_KEYS,
  SWITCH_LABELS,
  applySwitchChange,
  chatAccessLabel,
  chatCatalogView,
  chatRefusal,
  chatTemplateLabel,
  clientDialogsLabel,
  dropsChatDraft,
  effectiveChatTemplate,
  homePlaneLabel,
  lockedSwitches,
  readChatSwitches,
  storedChatSwitches,
} from '../chatRoleSet'
import { isStaleHubCatalogueRefusal } from '../hubRoles'
import type { ChatSwitches, HubRoleCatalog } from '../types'

function lookup(locale: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      locale
    )
}

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

function refusal(status: number, code: string, params?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { detail: 'server text', code, params } },
  })
}

describe('the names of the chat codes', () => {
  it('follow the backend order of the switches', () => {
    expect(SWITCH_KEYS).toEqual([
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

  it('name the nine templates, six screens and four dialogue scopes of the backend', () => {
    expect(NAMED_CHAT_TEMPLATES.sort()).toEqual(
      [
        'admin',
        'supervisor',
        'operator',
        'lawyer',
        'employee',
        'training_workspace',
        'quality_workspace',
        'ai_agent',
        'none',
      ].sort()
    )
    expect(NAMED_HOME_PLANES).toEqual([
      'operator',
      'legal',
      'training',
      'quality',
      'control',
      'my_day',
    ])
    expect(NAMED_CLIENT_DIALOGS).toEqual(['none', 'my', 'department', 'all'])
  })

  it('say the screens and templates in the owner’s words', () => {
    const say = (label: { labelKey: string } | null) => lookup(uk, label?.labelKey ?? '')
    expect(NAMED_HOME_PLANES.map((code) => say(homePlaneLabel(code)))).toEqual([
      'Мої клієнти',
      'Мої справи',
      'Мої групи',
      'Черга оцінки',
      'Контроль команди',
      'Мій день',
    ])
    expect(
      [
        'employee',
        'operator',
        'supervisor',
        'admin',
        'lawyer',
        'training_workspace',
        'ai_agent',
      ].map((code) => say(chatTemplateLabel(code)))
    ).toEqual(['Співробітник', 'Оператор', 'Керівник', 'Адміністратор', 'Юрист', 'Тренер', 'Бот'])
    expect(say(chatTemplateLabel('quality_workspace'))).toBe('Контроль якості')
    expect(say(chatTemplateLabel('none'))).toBe('Без доступу до чату')
  })

  it('have no name for a code they do not know', () => {
    expect(chatTemplateLabel('accountant')).toBeNull()
    expect(homePlaneLabel('dashboard')).toBeNull()
    expect(clientDialogsLabel('group')).toBeNull()
  })

  it('read chat_access of the list as yes, no or not filled', () => {
    expect(chatAccessLabel(true)).toBe(CHAT_ACCESS_LABELS.yes)
    expect(chatAccessLabel(false)).toBe(CHAT_ACCESS_LABELS.no)
    expect(chatAccessLabel(null)).toBe(CHAT_ACCESS_LABELS.notFilled)
    expect(chatAccessLabel(undefined)).toBe(CHAT_ACCESS_LABELS.notFilled)
  })
})

describe('chat texts in the three languages', () => {
  const keys = [
    ...SWITCH_KEYS.flatMap((key) => [
      SWITCH_LABELS[key].labelKey,
      SWITCH_LABELS[key].hint.labelKey,
    ]),
    ...NAMED_CLIENT_DIALOGS.map((code) => clientDialogsLabel(code)?.labelKey),
    ...NAMED_HOME_PLANES.map((code) => homePlaneLabel(code)?.labelKey),
    ...NAMED_CHAT_TEMPLATES.map((code) => chatTemplateLabel(code)?.labelKey),
    ...Object.values(CHAT_ACCESS_LABELS).map((label) => label.labelKey),
    ...[
      'title',
      'hint',
      'notFilled',
      'fill',
      'cancelFill',
      'editedByHand',
      'readOnlyNoRight',
      'lockedByAccess',
      'lockedByChatOnly',
      'unreadable',
      'outdated',
      'template.impersonating',
      'readOnlyImpersonating',
      'readOnlyCatalogue',
      'yes',
      'no',
      'homePlane',
      'homePlaneHint',
      'template.label',
      'template.none',
      'template.needsHubAdmin',
      'template.hint',
      'list.header',
      'errors.invalid',
      'errors.conflict',
      'errors.broken',
      'errors.homePlaneUnknown',
      'errors.templateUnknown',
      'errors.templateImmutable',
      'errors.templateConflict',
      'errors.unknownHubRole',
      'errors.adminRequired',
      'errors.impersonating',
    ].map((key) => `pages.roles.chat.${key}`),
  ] as string[]

  it.each([
    ['uk', uk],
    ['en', en],
    ['es', es],
  ])('are non-empty strings without placeholders in %s', (_language, dictionary) => {
    const missing = keys.filter((key) => {
      const value = lookup(dictionary, key)
      return typeof value !== 'string' || value.trim() === '' || value.includes('{{')
    })
    expect(missing).toEqual([])
  })

  it('have the same keys in the three languages', () => {
    const shape = (node: unknown, prefix = ''): string[] =>
      node && typeof node === 'object'
        ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
            shape(value, `${prefix}${key}.`)
          )
        : [prefix]
    const chat = (dictionary: unknown) => shape(lookup(dictionary, 'pages.roles.chat')).sort()
    expect(chat(en)).toEqual(chat(uk))
    expect(chat(es)).toEqual(chat(uk))
  })
})

describe('reading the switches of a role', () => {
  it('takes the eight switches in form order', () => {
    const reversed = Object.fromEntries(Object.entries(OPERATOR).reverse())
    const read = readChatSwitches(reversed)
    expect(read).toEqual(OPERATOR)
    expect(Object.keys(read ?? {})).toEqual([...SWITCH_KEYS])
  })

  it('reads null, a missing switch or a value of the wrong type as not filled', () => {
    expect(readChatSwitches(null)).toBeNull()
    expect(readChatSwitches(undefined)).toBeNull()
    expect(readChatSwitches({})).toBeNull()
    expect(readChatSwitches([])).toBeNull()
    const seven = Object.fromEntries(Object.entries(OPERATOR).filter(([key]) => key !== 'lead'))
    expect(readChatSwitches(seven)).toBeNull()
    expect(readChatSwitches({ ...OPERATOR, access: 1 })).toBeNull()
    expect(readChatSwitches({ ...OPERATOR, client_dialogs: true })).toBeNull()
  })
})

describe('telling a role not filled from a stored value that cannot be read', () => {
  it('is not filled only for null or no key; anything else unreadable is said so', () => {
    expect(storedChatSwitches(null)).toEqual({ kind: 'notFilled' })
    expect(storedChatSwitches(undefined)).toEqual({ kind: 'notFilled' })
    expect(storedChatSwitches({ ...OPERATOR })).toEqual({ kind: 'filled', switches: OPERATOR })
    expect(storedChatSwitches({ access: true })).toEqual({ kind: 'unreadable' })
    expect(storedChatSwitches({ ...OPERATOR, lead: 'yes' })).toEqual({ kind: 'unreadable' })
    expect(storedChatSwitches('broken')).toEqual({ kind: 'unreadable' })
  })
})

describe('the two combinations the API refuses by rule', () => {
  it('access off turns every other switch off and locks them', () => {
    const off = applySwitchChange(OPERATOR, 'access', false)
    expect(off).toEqual(NO_ACCESS_SWITCHES)
    expect([...lockedSwitches(off)].sort()).toEqual(
      SWITCH_KEYS.filter((key) => key !== 'access').sort()
    )
  })

  it('access back on leaves the rest off for somebody to choose', () => {
    expect(applySwitchChange(NO_ACCESS_SWITCHES, 'access', true)).toEqual({
      ...NO_ACCESS_SWITCHES,
      access: true,
    })
    expect(lockedSwitches({ ...NO_ACCESS_SWITCHES, access: true }).size).toBe(0)
  })

  it('chat only sets what the bot set demands and locks it', () => {
    const bot = applySwitchChange(
      { ...OPERATOR, lead: true, dept_channel_admin: true },
      'chat_only',
      true
    )
    expect(bot).toEqual({
      access: true,
      client_dialogs: 'none',
      create_groups: false,
      dept_channel_admin: false,
      download_files: true,
      ai_assistant: false,
      chat_only: true,
      lead: false,
    })
    expect([...lockedSwitches(bot)].sort()).toEqual(
      [
        'client_dialogs',
        'create_groups',
        'dept_channel_admin',
        'download_files',
        'ai_assistant',
        'lead',
      ].sort()
    )
  })

  it('moves only the switch asked otherwise', () => {
    expect(applySwitchChange(OPERATOR, 'lead', true)).toEqual({ ...OPERATOR, lead: true })
    expect(applySwitchChange(OPERATOR, 'client_dialogs', 'all')).toEqual({
      ...OPERATOR,
      client_dialogs: 'all',
    })
    expect(lockedSwitches(OPERATOR).size).toBe(0)
  })
})

describe('reading the chat part of the catalogue', () => {
  const answered = (data: unknown) =>
    chatCatalogView({ isPending: false, isError: false, data: data as HubRoleCatalog })

  it('is ready with the lists the backend sends', () => {
    expect(
      answered({
        mode: 'off',
        enabled: false,
        options: [],
        chat_templates: [
          { code: 'admin', assignable: false },
          { code: 'operator', assignable: true },
        ],
        home_planes: ['operator', 'my_day'],
        client_dialog_values: ['none', 'my'],
      })
    ).toEqual({
      status: 'ready',
      templates: [
        { code: 'admin', assignable: false },
        { code: 'operator', assignable: true },
      ],
      homePlanes: ['operator', 'my_day'],
      clientDialogValues: ['none', 'my'],
    })
  })

  it('is unavailable for a backend that predates the lists, or a failed request', () => {
    expect(answered({ mode: 'on', enabled: true, options: [] }).status).toBe('unavailable')
    expect(answered(null).status).toBe('unavailable')
    expect(chatCatalogView({ isPending: false, isError: true, data: undefined }).status).toBe(
      'unavailable'
    )
    expect(chatCatalogView({ isPending: true, isError: false, data: undefined }).status).toBe(
      'loading'
    )
  })

  const READY = {
    mode: 'off',
    enabled: false,
    options: [],
    chat_templates: [{ code: 'operator', assignable: true }],
    home_planes: ['operator'],
    client_dialog_values: ['none'],
  } as unknown as HubRoleCatalog

  it('is unavailable, not loading for ever, when there is no project to ask about', () => {
    // A disabled TanStack query stays pending: without `enabled` it would wait.
    expect(
      chatCatalogView({ isPending: true, isError: false, data: undefined, enabled: false }).status
    ).toBe('unavailable')
  })

  it('keeps the answer it has while a refetch fails', () => {
    expect(
      chatCatalogView({ isPending: false, isError: true, data: READY, error: refusal(500, 'X') })
    ).toMatchObject({ status: 'ready', templates: [{ code: 'operator', assignable: true }] })
  })

  it('says when the catalogue refused the caller (403), and only then', () => {
    expect(
      chatCatalogView({
        isPending: false,
        isError: true,
        data: undefined,
        error: refusal(403, 'PROJECT_SCOPE_DENIED'),
      })
    ).toMatchObject({ status: 'unavailable', forbidden: true })
    expect(
      chatCatalogView({
        isPending: false,
        isError: true,
        data: undefined,
        error: refusal(500, 'X'),
      }).forbidden
    ).toBeUndefined()
  })

  it('drops templates with a bad code and keeps a missing assignable non-assignable', () => {
    expect(
      answered({
        chat_templates: [
          { code: 'Admin!', assignable: true },
          { code: 'operator' },
          { code: 'operator', assignable: true },
          'lawyer',
        ],
        home_planes: ['operator', 7, 'operator'],
        client_dialog_values: [],
      })
    ).toEqual({
      status: 'ready',
      templates: [{ code: 'operator', assignable: false }],
      homePlanes: ['operator'],
      clientDialogValues: [],
    })
  })
})

describe('the template a create may send', () => {
  const templates = [
    { code: 'admin', assignable: false },
    { code: 'operator', assignable: true },
  ]

  it('is the pick while the catalogue offers it as assignable, else none', () => {
    expect(effectiveChatTemplate('operator', templates)).toBe('operator')
    expect(effectiveChatTemplate('admin', templates)).toBe('')
    expect(effectiveChatTemplate('lawyer', templates)).toBe('')
    expect(effectiveChatTemplate('', templates)).toBe('')
  })
})

describe('which field a refused save is about', () => {
  it.each([
    [
      'CHAT_SWITCHES_INVALID',
      422,
      { missing: ['lead'], bad_values: ['access'], unknown: ['x'] },
      'chat_switches',
      'invalid',
    ],
    [
      'CHAT_SWITCHES_CONFLICT',
      422,
      { conflicts: ['lead', 'create_groups'] },
      'chat_switches',
      'conflict',
    ],
    [
      'CHAT_SET_BROKEN',
      422,
      { role_id: 42, switches: ['ai_assistant'] },
      'chat_switches',
      'broken',
    ],
    [
      'CHAT_SET_UNKNOWN_HUB_ROLE',
      422,
      { hub_role: 'accountant', role_id: 42 },
      'chat_switches',
      'unknownHubRole',
    ],
    [
      'HOME_PLANE_UNKNOWN',
      422,
      { home_plane: 'dashboard', allowed: [] },
      'home_plane',
      'homePlaneUnknown',
    ],
    ['CHAT_TEMPLATE_UNKNOWN', 422, { chat_template: 'boss' }, 'chat_template', 'templateUnknown'],
    [
      'CHAT_TEMPLATE_IMMUTABLE',
      422,
      { chat_template: 'admin', stored: 'operator' },
      'chat_template',
      'templateImmutable',
    ],
    [
      'CHAT_TEMPLATE_CONFLICT',
      422,
      { hub_role: 'admin', chat_template: 'operator' },
      'chat_template',
      'templateConflict',
    ],
  ] as const)('%s belongs to %s', (code, status, params, field, reason) => {
    const found = chatRefusal(refusal(status, code, params))
    expect(found?.field).toBe(field)
    expect(found?.reason).toBe(reason)
    expect(found?.code).toBe(code)
  })

  it('names the switches in form order and keeps names that are no switch apart', () => {
    expect(
      chatRefusal(
        refusal(422, 'CHAT_SWITCHES_INVALID', {
          missing: ['lead', 'access'],
          bad_values: ['client_dialogs'],
          unknown: ['colour'],
        })
      )
    ).toMatchObject({
      switches: ['access', 'client_dialogs', 'lead'],
      others: ['colour'],
      value: null,
    })
    expect(
      chatRefusal(refusal(422, 'CHAT_SWITCHES_CONFLICT', { conflicts: ['lead', 'create_groups'] }))
    ).toMatchObject({
      switches: ['create_groups', 'lead'],
      others: [],
    })
  })

  it('says only names: objects in the params are left out, not «[object Object]»', () => {
    expect(
      chatRefusal(
        refusal(422, 'CHAT_SWITCHES_INVALID', {
          missing: [{ key: 'lead' }, 'access', ['x'], 7],
          unknown: [null, true],
        })
      )
    ).toMatchObject({ switches: ['access'], others: ['7'] })
    expect(
      chatRefusal(refusal(422, 'HOME_PLANE_UNKNOWN', { home_plane: { a: 1 } }))?.value
    ).toBeNull()
  })

  it('refetches the catalogue on a template or screen it no longer offers', () => {
    for (const code of ['CHAT_TEMPLATE_UNKNOWN', 'HOME_PLANE_UNKNOWN']) {
      expect(isStaleHubCatalogueRefusal(refusal(422, code))).toBe(true)
    }
    for (const code of ['CHAT_SWITCHES_CONFLICT', 'CHAT_SWITCHES_INVALID', 'CHAT_SET_BROKEN']) {
      expect(isStaleHubCatalogueRefusal(refusal(422, code))).toBe(false)
    }
  })

  it('names the value a refusal sends back', () => {
    expect(
      chatRefusal(refusal(422, 'HOME_PLANE_UNKNOWN', { home_plane: 'dashboard' }))?.value
    ).toBe('dashboard')
    expect(chatRefusal(refusal(422, 'HOME_PLANE_UNKNOWN', { home_plane: null }))?.value).toBeNull()
    expect(chatRefusal(refusal(422, 'CHAT_SWITCHES_CONFLICT'))).toMatchObject({
      switches: [],
      others: [],
    })
  })

  it.each(['HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN', 'HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING'])(
    '%s goes to the field params.field names',
    (code) => {
      for (const field of ['chat_switches', 'home_plane', 'chat_template'] as const) {
        expect(chatRefusal(refusal(403, code, { project_id: 5, field }))?.field).toBe(field)
      }
      // hub_role is no field of the form any more: the chat section says it.
      expect(chatRefusal(refusal(403, code, { field: 'hub_role' }))?.field).toBe('chat_switches')
      // The name, or no field at all, is not the chat's: the form's alert says it.
      expect(chatRefusal(refusal(403, code, { field: 'name' }))).toBeNull()
      expect(chatRefusal(refusal(403, code))).toBeNull()
    }
  )

  it('is null for a refusal that is not about the chat, or no HTTP answer', () => {
    expect(chatRefusal(refusal(403, 'PROJECT_SCOPE_DENIED'))).toBeNull()
    expect(chatRefusal(new Error('boom'))).toBeNull()
  })

  it('drops what was set in the section only on a 403 - a 422 is to be corrected', () => {
    expect(
      dropsChatDraft(
        chatRefusal(refusal(403, 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN', { field: 'chat_switches' }))
      )
    ).toBe(true)
    expect(
      dropsChatDraft(
        chatRefusal(
          refusal(403, 'HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING', { field: 'chat_template' })
        )
      )
    ).toBe(true)
    expect(
      dropsChatDraft(chatRefusal(refusal(422, 'CHAT_SWITCHES_CONFLICT', { conflicts: ['lead'] })))
    ).toBe(false)
    expect(dropsChatDraft(null)).toBe(false)
  })
})
