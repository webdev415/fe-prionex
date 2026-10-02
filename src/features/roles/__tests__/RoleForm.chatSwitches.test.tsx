/**
 * «Чат (HUB)» of the role forms (board #1621, story 4), driven through the
 * real rolesApi against a stubbed HTTP client: the eight switches and the
 * screen with the values GET returned, what a save sends, the two
 * combinations the API refuses by rule, the read-only states, a role that is
 * not filled, the template on create and the refusals said at their field.
 *
 * All of it on a build with VITE_ROLE_CHAT_SETTINGS_ENABLED on (rule 28.5);
 * with it off the forms are as before story 4 (EditRoleForm.hubRole.test.tsx,
 * roleChatSettingsFlag.test.tsx).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ChatSwitches, HubRoleCatalog, RoleDetailResponse } from '../types'
import type { User } from '@/types/api'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

// The real module behind the stubbed client: the role forms read the auth
// store (manage_roles, impersonation), which wires itself to the api module.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: mockApi,
  default: mockApi,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/features/departments', () => ({
  useDepartments: () => ({ data: { departments: [] }, isLoading: false }),
}))

/*
 * Read in Ukrainian from the real uk/common.json: a key missing from the file
 * falls back to the English default and the assertion on the words fails.
 */
vi.mock('react-i18next', async () => {
  const uk = (await import('@/../public/locales/uk/common.json')).default as unknown
  const lookup = (key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        uk
      )
  const t = (key: string, second?: unknown, third?: unknown) => {
    const options = (
      second && typeof second === 'object'
        ? second
        : third && typeof third === 'object'
          ? third
          : {}
    ) as Record<string, unknown>
    const found = lookup(key)
    const fallback = typeof second === 'string' ? second : (options.defaultValue as string)
    const template = typeof found === 'string' ? found : (fallback ?? key)
    return template.replace(/\{\{(\w+)\}\}/g, (_: string, name: string) =>
      name in options ? String(options[name]) : `{{${name}}}`
    )
  }
  return {
    useTranslation: () => ({ t, i18n: { language: 'uk', changeLanguage: vi.fn() } }),
    Trans: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

const { EditRoleForm } = await import('../components/EditRoleForm')
const { CreateRoleForm } = await import('../components/CreateRoleForm')
const { ViewRoleForm } = await import('../components/ViewRoleForm')
const { useAuthStore } = await import('@/stores/authStore')
const { ROLE_CHAT_SETTINGS_FLAG } = await import('../roleChatSettingsFlag')

const PROJECT = 5
const HUB_ROLES_URL = '/api/v1/admin/roles/hub-roles'

/** The switch names in Ukrainian, by key. */
const NAMES = {
  access: 'Доступ до чату',
  create_groups: 'Створювати групи',
  dept_channel_admin: 'Адміністратор каналу відділу',
  download_files: 'Завантажувати файли',
  ai_assistant: 'ШІ-асистент',
  chat_only: 'Лише чат (бот)',
  lead: 'Права керівника',
} as const
const DIALOGS = 'Діалоги з клієнтами'
const SCREEN = 'Екран ролі'

type Toggle = keyof typeof NAMES

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

const NO_ACCESS: ChatSwitches = {
  access: false,
  client_dialogs: 'none',
  create_groups: false,
  dept_channel_admin: false,
  download_files: false,
  ai_assistant: false,
  chat_only: false,
  lead: false,
}

const catalog: HubRoleCatalog = {
  mode: 'emit',
  enabled: false,
  options: [],
  chat_templates: [
    { code: 'admin', assignable: false },
    { code: 'supervisor', assignable: true },
    { code: 'operator', assignable: true },
    { code: 'lawyer', assignable: true },
    { code: 'employee', assignable: true },
    { code: 'training_workspace', assignable: true },
    { code: 'quality_workspace', assignable: true },
    { code: 'ai_agent', assignable: true },
    { code: 'none', assignable: true },
  ],
  home_planes: ['operator', 'legal', 'training', 'quality', 'control', 'my_day'],
  client_dialog_values: ['none', 'my', 'department', 'all'],
}

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

type CatalogAnswer = HubRoleCatalog | Error

function answerWith(...catalogs: [CatalogAnswer, ...CatalogAnswer[]]) {
  let asked = 0
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === HUB_ROLES_URL) {
      const answer = catalogs[Math.min(asked, catalogs.length - 1)]
      asked += 1
      if (answer instanceof Error) throw answer
      return { data: answer }
    }
    if (url === '/api/v1/admin/permissions') {
      return {
        data: {
          permissions: [{ id: 1, code: 'view_clients', name: 'view_clients', category: 'Clients' }],
        },
      }
    }
    throw new Error(`unexpected GET ${url}`)
  })
}

function role(overrides: Partial<RoleDetailResponse> = {}): RoleDetailResponse {
  return {
    id: 42,
    project_id: PROJECT,
    name: 'Андеррайтер',
    description: 'Checks applications',
    department_id: null,
    is_default: false,
    is_active: true,
    permission_count: 1,
    user_count: 3,
    permissions: [{ id: 1, code: 'view_clients', name: 'view_clients', category: 'Clients' }],
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    hub_role: 'operator',
    chat_switches: { ...OPERATOR },
    home_plane: 'operator',
    chat_template: 'operator',
    chat_set_follows_hub_role: true,
    ...overrides,
  }
}

function signIn(permissions: string[], isImpersonating = false) {
  useAuthStore.setState({
    user: { id: '1', permissions } as unknown as User,
    isImpersonating,
  })
}

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function renderEdit(overrides: Partial<RoleDetailResponse> = {}) {
  return renderWithClient(
    <EditRoleForm role={role(overrides)} projectName="Техно" onSuccess={vi.fn()} />
  )
}

const toggle = (key: Toggle) => screen.getByRole('switch', { name: NAMES[key] })

/** Waits for the section's controls - they come with the catalogue. */
async function controlsReady() {
  return screen.findByRole('switch', { name: NAMES.access })
}

async function save(container: HTMLElement, times = 1) {
  fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)
  await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(times))
  const [url, body] = mockApi.put.mock.calls[times - 1]
  expect(url).toBe('/api/v1/admin/roles/42')
  return body as Record<string, unknown>
}

function expectNoChatKeys(body: Record<string, unknown>) {
  for (const key of ['chat_switches', 'home_plane', 'chat_template', 'hub_role']) {
    expect(Object.keys(body)).not.toContain(key)
  }
}

beforeEach(() => {
  vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'true')
  mockApi.get.mockReset()
  mockApi.post.mockReset()
  mockApi.put.mockReset()
  mockApi.post.mockResolvedValue({ data: role() })
  mockApi.put.mockResolvedValue({ data: role() })
  signIn(['manage_roles'])
})

afterEach(() => {
  vi.unstubAllEnvs()
  useAuthStore.setState({ user: null, isImpersonating: false })
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('EditRoleForm - chat switches', () => {
  it('shows the eight switches in form order and the screen with the values GET returned', async () => {
    answerWith(catalog)
    renderEdit()
    await controlsReady()

    const section = screen.getByRole('region', { name: 'Чат (HUB)' })
    expect(
      within(section)
        .getAllByRole('switch')
        .map((one) => one.getAttribute('aria-label'))
    ).toEqual([
      NAMES.access,
      NAMES.create_groups,
      NAMES.dept_channel_admin,
      NAMES.download_files,
      NAMES.ai_assistant,
      NAMES.chat_only,
      NAMES.lead,
    ])
    for (const key of Object.keys(NAMES) as Toggle[]) {
      if (OPERATOR[key]) expect(toggle(key)).toBeChecked()
      else expect(toggle(key)).not.toBeChecked()
    }
    const dialogs = screen.getByLabelText(DIALOGS)
    expect(dialogs).toHaveValue('my')
    expect(
      within(dialogs)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Немає', 'Свої', 'Відділу', 'Усі'])
    const plane = screen.getByLabelText(SCREEN)
    expect(plane).toHaveValue('operator')
    expect(
      within(plane)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual([
      'Мої клієнти',
      'Мої справи',
      'Мої групи',
      'Черга оцінки',
      'Контроль команди',
      'Мій день',
    ])
  })

  it.each([
    'create_groups',
    'dept_channel_admin',
    'download_files',
    'ai_assistant',
    'lead',
  ] as const)('sends all eight switches and the screen when %s is flipped', async (key) => {
    answerWith(catalog)
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.click(toggle(key))
    const body = await save(container)

    expect(body.chat_switches).toEqual({ ...OPERATOR, [key]: !OPERATOR[key] })
    expect(body.home_plane).toBe('operator')
    expect(Object.keys(body)).not.toContain('chat_template')
    expect(Object.keys(body)).not.toContain('hub_role')
  })

  it('sends the dialogue scope that was chosen', async () => {
    answerWith(catalog)
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.selectOptions(screen.getByLabelText(DIALOGS), 'department')
    const body = await save(container)

    expect(body.chat_switches).toEqual({ ...OPERATOR, client_dialogs: 'department' })
  })

  it('sends the screen that was chosen, with the switches as they are', async () => {
    answerWith(catalog)
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.selectOptions(screen.getByLabelText(SCREEN), 'legal')
    const body = await save(container)

    expect(body.chat_switches).toEqual(OPERATOR)
    expect(body.home_plane).toBe('legal')
  })

  it('turns everything off with access, and locks it', async () => {
    answerWith(catalog)
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.click(toggle('access'))

    for (const key of Object.keys(NAMES) as Toggle[]) {
      expect(toggle(key)).not.toBeChecked()
      if (key !== 'access') expect(toggle(key)).toBeDisabled()
    }
    expect(screen.getByLabelText(DIALOGS)).toHaveValue('none')
    expect(screen.getByLabelText(DIALOGS)).toBeDisabled()
    expect(toggle('access')).toBeEnabled()
    const body = await save(container)

    expect(body.chat_switches).toEqual(NO_ACCESS)
  })

  it('gives «chat only» what it demands, and locks those switches', async () => {
    answerWith(catalog)
    const { container } = renderEdit({ chat_switches: { ...OPERATOR, lead: true } })
    await controlsReady()

    await userEvent.click(toggle('chat_only'))

    expect(screen.getByLabelText(DIALOGS)).toHaveValue('none')
    expect(screen.getByLabelText(DIALOGS)).toBeDisabled()
    for (const key of ['create_groups', 'ai_assistant', 'lead', 'dept_channel_admin'] as const) {
      expect(toggle(key)).not.toBeChecked()
      expect(toggle(key)).toBeDisabled()
    }
    expect(toggle('download_files')).toBeChecked()
    expect(toggle('download_files')).toBeDisabled()
    expect(toggle('access')).toBeEnabled()
    expect(toggle('chat_only')).toBeEnabled()
    const body = await save(container)

    expect(body.chat_switches).toEqual({
      access: true,
      client_dialogs: 'none',
      create_groups: false,
      dept_channel_admin: false,
      download_files: true,
      ai_assistant: false,
      chat_only: true,
      lead: false,
    })
  })

  it('sends no chat field when the section was not touched', async () => {
    answerWith(catalog)
    const { container } = renderEdit()
    await controlsReady()

    expectNoChatKeys(await save(container))
  })

  it('sends no chat field when a switch was flipped and flipped back', async () => {
    answerWith(catalog)
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.click(toggle('lead'))
    await userEvent.click(toggle('lead'))

    expectNoChatKeys(await save(container))
  })

  it('says when the settings were changed by hand', async () => {
    answerWith(catalog)
    renderEdit({ chat_set_follows_hub_role: false })
    await controlsReady()

    expect(screen.getByText('Налаштування чату змінені вручну')).toBeInTheDocument()
  })

  it('does not say so for settings that follow the template', async () => {
    answerWith(catalog)
    renderEdit()
    await controlsReady()

    expect(screen.queryByText('Налаштування чату змінені вручну')).not.toBeInTheDocument()
  })
})

describe('EditRoleForm - a role whose chat settings are not filled', () => {
  const NOT_FILLED =
    'Налаштування чату для цієї ролі ще не заповнено: доступ у HUB поки визначається як раніше.'

  it('says so, offers to fill them and sends nothing until somebody does', async () => {
    answerWith(catalog)
    const { container } = renderEdit({ chat_switches: null, home_plane: 'my_day' })

    expect(await screen.findByRole('button', { name: 'Заповнити налаштування чату' })).toBeEnabled()
    expect(screen.getByText(NOT_FILLED)).toBeInTheDocument()
    expect(screen.queryAllByRole('switch')).toHaveLength(0)

    expectNoChatKeys(await save(container))
  })

  it('fills them: every switch off to start, the screen from GET, and the save creates the set', async () => {
    answerWith(catalog)
    const { container } = renderEdit({ chat_switches: null, home_plane: 'my_day' })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Заповнити налаштування чату' })
    )
    expect(toggle('access')).not.toBeChecked()
    await userEvent.click(toggle('access'))
    await userEvent.click(toggle('download_files'))
    const body = await save(container)

    expect(body.chat_switches).toEqual({ ...NO_ACCESS, access: true, download_files: true })
    expect(body.home_plane).toBe('my_day')
  })

  it('leaves them not filled when the filling is cancelled', async () => {
    answerWith(catalog)
    const { container } = renderEdit({ chat_switches: null, home_plane: 'my_day' })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Заповнити налаштування чату' })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Залишити налаштування чату незаповненими' })
    )

    expect(screen.getByText(NOT_FILLED)).toBeInTheDocument()
    expectNoChatKeys(await save(container))
  })
})

describe('EditRoleForm - chat settings read only', () => {
  async function expectValuesAsText() {
    const section = await screen.findByRole('region', { name: 'Чат (HUB)' })
    expect(within(section).queryAllByRole('switch')).toHaveLength(0)
    expect(within(section).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(section).getByText(`${NAMES.access}:`).nextSibling).toHaveTextContent('Так')
    expect(within(section).getByText(`${NAMES.lead}:`).nextSibling).toHaveTextContent('Ні')
    expect(within(section).getByText(`${DIALOGS}:`).nextSibling).toHaveTextContent('Свої')
    expect(within(section).getByText(`${SCREEN}:`).nextSibling).toHaveTextContent('Мої клієнти')
    return section
  }

  it('shows the values without controls to someone who does not manage roles', async () => {
    signIn([])
    answerWith(catalog)
    const { container } = renderEdit()

    await expectValuesAsText()
    expect(
      screen.getByText('Змінювати налаштування чату може лише той, хто керує ролями цього проєкту.')
    ).toBeInTheDocument()
    expectNoChatKeys(await save(container))
  })

  it('shows the values without controls while acting as another user', async () => {
    signIn(['manage_roles'], true)
    answerWith(catalog)
    const { container } = renderEdit()

    await expectValuesAsText()
    expect(
      screen.getByText(
        'Під час роботи від імені іншого користувача налаштування чату показано лише для перегляду.'
      )
    ).toBeInTheDocument()
    expectNoChatKeys(await save(container))
  })

  it('shows the values without controls when the catalogue is unavailable', async () => {
    answerWith(httpError(500, { detail: 'boom' }))
    const { container } = renderEdit()

    await waitFor(() =>
      expect(
        screen.getByText(
          'Значення для вибору зараз недоступні, тому налаштування чату показано лише для перегляду.'
        )
      ).toBeInTheDocument()
    )
    await expectValuesAsText()
    expectNoChatKeys(await save(container))
  })

  it('offers no filling to someone who does not manage roles', async () => {
    signIn([])
    answerWith(catalog)
    renderEdit({ chat_switches: null })

    expect(
      await screen.findByText(
        'Налаштування чату для цієї ролі ще не заповнено: доступ у HUB поки визначається як раніше.'
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Заповнити налаштування чату' })
    ).not.toBeInTheDocument()
  })
})

describe('EditRoleForm - chat refusals at their field', () => {
  it('says a conflict at the switches, naming them, and keeps the values to correct', async () => {
    answerWith(catalog)
    mockApi.put.mockRejectedValueOnce(
      httpError(422, {
        detail: 'These switches contradict access or chat_only: create_groups.',
        code: 'CHAT_SWITCHES_CONFLICT',
        params: { conflicts: ['create_groups'] },
      })
    )
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.click(toggle('lead'))
    await save(container)

    expect(
      await screen.findByText(
        'Ці перемикачі суперечать доступу до чату або режиму «Лише чат». (Створювати групи)'
      )
    ).toBeInTheDocument()
    expect(toggle('lead')).toBeChecked()
  })

  it('says an unknown screen at the screen picker', async () => {
    answerWith(catalog)
    mockApi.put.mockRejectedValueOnce(
      httpError(422, {
        detail: 'Unknown HUB home screen.',
        code: 'HOME_PLANE_UNKNOWN',
        params: { home_plane: 'legal', allowed: ['operator'] },
      })
    )
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.selectOptions(screen.getByLabelText(SCREEN), 'legal')
    await save(container)

    const note = await screen.findByText('Такого екрана ролі немає. (legal)')
    expect(screen.getByLabelText(SCREEN).parentElement).toContainElement(note)
  })

  it('drops the change the caller may not make, at the field the API names, so a retry passes', async () => {
    answerWith(catalog)
    mockApi.put.mockRejectedValueOnce(
      httpError(403, {
        detail: 'Only a HUB admin may change the admin set',
        code: 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
        params: { project_id: PROJECT, field: 'home_plane' },
      })
    )
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.selectOptions(screen.getByLabelText(SCREEN), 'control')
    const refused = await save(container)
    expect(refused.home_plane).toBe('control')

    const note = await screen.findByText(
      'Цю зміну налаштувань чату може зробити лише адміністратор HUB цього проєкту.'
    )
    expect(screen.getByLabelText(SCREEN).parentElement).toContainElement(note)
    await waitFor(() => expect(screen.getByLabelText(SCREEN)).toHaveValue('operator'))
    expectNoChatKeys(await save(container, 2))
  })
})

describe('ViewRoleForm - chat settings', () => {
  it('shows the values read only and asks no catalogue', async () => {
    answerWith(catalog)
    renderWithClient(
      <ViewRoleForm role={role({ chat_set_follows_hub_role: false })} projectName="Техно" />
    )

    const section = screen.getByRole('region', { name: 'Чат (HUB)' })
    expect(within(section).queryAllByRole('switch')).toHaveLength(0)
    expect(within(section).getByText(`${NAMES.download_files}:`).nextSibling).toHaveTextContent(
      'Так'
    )
    expect(within(section).getByText(`${NAMES.chat_only}:`).nextSibling).toHaveTextContent('Ні')
    expect(within(section).getByText(`${SCREEN}:`).nextSibling).toHaveTextContent('Мої клієнти')
    expect(within(section).getByText('Налаштування чату змінені вручну')).toBeInTheDocument()
    expect(within(section).queryByLabelText('Шаблон прав чату')).not.toBeInTheDocument()
    expect(mockApi.get).not.toHaveBeenCalledWith(HUB_ROLES_URL, expect.anything())
  })

  it('says a role is not filled, without offering to fill it', () => {
    answerWith(catalog)
    renderWithClient(<ViewRoleForm role={role({ chat_switches: null })} projectName="Техно" />)

    expect(
      screen.getByText(
        'Налаштування чату для цієї ролі ще не заповнено: доступ у HUB поки визначається як раніше.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Заповнити налаштування чату' })).toBeNull()
  })

  it.each([
    ['a string', 'operator'],
    ['an object with no switches', {}],
    ['an object with some of them', { access: true }],
  ])('says a stored value it cannot read (%s) as unreadable, not as not filled', (_, value) => {
    answerWith(catalog)
    renderWithClient(
      <ViewRoleForm
        role={role({ chat_switches: value as unknown as ChatSwitches })}
        projectName="Техно"
      />
    )

    expect(
      screen.getByText(
        'Збережені налаштування чату цієї ролі не вдається показати. Їх залишено як є; зверніться до адміністратора.'
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Налаштування чату для цієї ролі ще не заповнено: доступ у HUB поки визначається як раніше.'
      )
    ).toBeNull()
  })
})

describe('CreateRoleForm - chat template', () => {
  async function fillAndSubmit(container: HTMLElement) {
    await userEvent.type(container.querySelector('#name') as HTMLInputElement, 'Андеррайтер')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'view_clients' }))
    fireEvent.submit(container.querySelector('form#create-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalled())
    const calls = mockApi.post.mock.calls
    const [url, body] = calls[calls.length - 1]
    expect(url).toBe('/api/v1/admin/roles')
    return body as Record<string, unknown>
  }

  it('offers the nine templates by name, the admin one closed with the reason, no switches', async () => {
    answerWith(catalog)
    renderWithClient(<CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />)

    const picker = await screen.findByLabelText(/Шаблон прав чату/)
    const options = within(picker).getAllByRole('option')

    expect(options.map((option) => option.textContent)).toEqual([
      'Не обрано — налаштування чату залишаться незаповненими',
      'Адміністратор (потрібен адміністратор HUB)',
      'Керівник',
      'Оператор',
      'Юрист',
      'Співробітник',
      'Тренер',
      'Контроль якості',
      'Бот',
      'Без доступу до чату',
    ])
    expect(within(picker).getByRole('option', { name: /Адміністратор/ })).toBeDisabled()
    expect(within(picker).getByRole('option', { name: 'Оператор' })).toBeEnabled()
    expect(picker).toHaveValue('')
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.queryByLabelText(SCREEN)).not.toBeInTheDocument()
  })

  it('sends the chosen template with the new role', async () => {
    answerWith(catalog)
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Шаблон прав чату/), 'lawyer')
    const body = await fillAndSubmit(container)

    expect(body.chat_template).toBe('lawyer')
    expect(Object.keys(body)).not.toContain('hub_role')
  })

  it('sends no chat_template when none was chosen', async () => {
    answerWith(catalog)
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await screen.findByLabelText(/Шаблон прав чату/)
    const body = await fillAndSubmit(container)

    expect(Object.keys(body)).not.toContain('chat_template')
  })

  it('hides the picker and sends no template when the catalogue is unavailable', async () => {
    answerWith(httpError(500, { detail: 'boom' }))
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith(HUB_ROLES_URL, { params: { project_id: PROJECT } })
    )
    const body = await fillAndSubmit(container)

    expect(screen.queryByLabelText(/Шаблон прав чату/)).not.toBeInTheDocument()
    expect(Object.keys(body)).not.toContain('chat_template')
  })

  it('says a refused template at the picker and drops it, so a retry creates the role without it', async () => {
    answerWith(catalog, {
      ...catalog,
      chat_templates: (catalog.chat_templates ?? []).map((one) => ({ ...one, assignable: false })),
    })
    mockApi.post.mockRejectedValueOnce(
      httpError(403, {
        detail: 'Not while impersonating',
        code: 'HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING',
        params: { field: 'chat_template' },
      })
    )
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Шаблон прав чату/), 'operator')
    const refused = await fillAndSubmit(container)
    expect(refused.chat_template).toBe('operator')

    const note = await screen.findByText(
      'Під час роботи від імені іншого користувача налаштування чату змінювати не можна.'
    )
    const picker = screen.getByLabelText(/Шаблон прав чату/)
    expect(picker.parentElement).toContainElement(note)
    await waitFor(() => expect(picker).toHaveValue(''))
    fireEvent.submit(container.querySelector('form#create-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(2))
    expect(Object.keys(mockApi.post.mock.calls[1][1] as object)).not.toContain('chat_template')
  })

  it('has no template picker in the edit form', async () => {
    answerWith(catalog)
    renderEdit()
    await controlsReady()

    expect(screen.queryByLabelText(/Шаблон прав чату/)).not.toBeInTheDocument()
  })
})

/*
 * Review round 1: the states and refusals the first round left without a
 * test, or that it got wrong.
 */
describe('EditRoleForm - review round 1', () => {
  const NOT_FILLED =
    'Налаштування чату для цієї ролі ще не заповнено: доступ у HUB поки визначається як раніше.'
  const ADMIN_ONLY = 'Цю зміну налаштувань чату може зробити лише адміністратор HUB цього проєкту.'

  function renderEditable(first: RoleDetailResponse) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const ui = (one: RoleDetailResponse) => (
      <QueryClientProvider client={client}>
        <EditRoleForm role={one} projectName="Техно" onSuccess={vi.fn()} />
      </QueryClientProvider>
    )
    const result = render(ui(first))
    return { ...result, rerenderWith: (next: RoleDetailResponse) => result.rerender(ui(next)) }
  }

  it('says a chat refusal once - at the section, not again in the form alert', async () => {
    answerWith(catalog)
    mockApi.put.mockRejectedValueOnce(
      httpError(403, {
        detail: 'Only a HUB admin may change the admin set',
        code: 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
        params: { field: 'chat_switches' },
      })
    )
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.click(toggle('lead'))
    await save(container)

    const note = await screen.findByText(ADMIN_ONLY)
    expect(screen.getAllByRole('alert')).toEqual([note])
  })

  it('still says a refusal that is not about the chat in the form alert', async () => {
    answerWith(catalog)
    mockApi.put.mockRejectedValueOnce(httpError(409, { detail: 'Role name taken' }))
    const { container } = renderEdit()
    await controlsReady()

    await save(container)

    const alert = await screen.findByRole('alert')
    expect(
      within(screen.getByRole('region', { name: 'Чат (HUB)' })).queryByRole('alert')
    ).toBeNull()
    expect(alert.closest('section')).toBeNull()
  })

  it('offers no filling over a stored value it cannot read, and sends nothing', async () => {
    answerWith(catalog)
    const { container } = renderEdit({
      chat_switches: { access: true } as unknown as ChatSwitches,
    })

    expect(
      await screen.findByText(
        'Збережені налаштування чату цієї ролі не вдається показати. Їх залишено як є; зверніться до адміністратора.'
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith(HUB_ROLES_URL, { params: { project_id: PROJECT } })
    )
    expect(screen.queryByRole('button', { name: 'Заповнити налаштування чату' })).toBeNull()
    expect(screen.queryByText(NOT_FILLED)).toBeNull()
    expectNoChatKeys(await save(container))
  })

  it('drops a draft when the stored values change under the open form, and says so', async () => {
    answerWith(catalog)
    const { container, rerenderWith } = renderEditable(role())
    await controlsReady()

    await userEvent.click(toggle('lead'))
    expect(toggle('lead')).toBeChecked()
    // Somebody else saved: the detail refetch hands the form new stored values.
    rerenderWith(role({ chat_switches: { ...OPERATOR, create_groups: false } }))

    expect(
      await screen.findByText(
        'Налаштування чату цієї ролі тим часом змінили; ваші зміни в цьому розділі скасовано, показано збережені значення.'
      )
    ).toBeInTheDocument()
    expect(toggle('lead')).not.toBeChecked()
    expect(toggle('create_groups')).not.toBeChecked()
    expectNoChatKeys(await save(container))
  })

  it('keeps a draft when the role is refetched with the same stored values', async () => {
    answerWith(catalog)
    const { container, rerenderWith } = renderEditable(role())
    await controlsReady()

    await userEvent.click(toggle('lead'))
    rerenderWith(role())

    expect(toggle('lead')).toBeChecked()
    expect((await save(container)).chat_switches).toEqual({ ...OPERATOR, lead: true })
  })

  it('keeps a draft when the refetch returns the same values with the keys in another order', async () => {
    answerWith(catalog)
    const { container, rerenderWith } = renderEditable(role())
    await controlsReady()
    const reordered = Object.fromEntries(
      Object.entries(OPERATOR).reverse()
    ) as unknown as ChatSwitches
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(OPERATOR))

    await userEvent.click(toggle('lead'))
    rerenderWith(role({ chat_switches: reordered }))

    expect(toggle('lead')).toBeChecked()
    expect(screen.queryByText(/тим часом змінили/)).toBeNull()
    expect((await save(container)).chat_switches).toEqual({ ...OPERATOR, lead: true })
  })

  it('shows the values as text, sends nothing, while the catalogue is still loading', async () => {
    mockApi.get.mockImplementation((url: string) =>
      url === HUB_ROLES_URL ? new Promise(() => {}) : Promise.resolve({ data: { permissions: [] } })
    )
    const { container } = renderEdit()

    const section = screen.getByRole('region', { name: 'Чат (HUB)' })
    expect(within(section).queryAllByRole('switch')).toHaveLength(0)
    expect(within(section).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(section).getByText(`${NAMES.access}:`).nextSibling).toHaveTextContent('Так')
    expectNoChatKeys(await save(container))
  })

  it('says the caller has no right when the catalogue refuses them (403)', async () => {
    answerWith(httpError(403, { detail: 'no', code: 'PROJECT_SCOPE_DENIED' }))
    renderEdit()

    expect(
      await screen.findByText(
        'Змінювати налаштування чату може лише той, хто керує ролями цього проєкту.'
      )
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
  })

  it('says the values are not available for a role without a project, not wait for ever', async () => {
    answerWith(catalog)
    renderEdit({ project_id: 0 })

    expect(
      await screen.findByText(
        'Значення для вибору зараз недоступні, тому налаштування чату показано лише для перегляду.'
      )
    ).toBeInTheDocument()
    expect(mockApi.get).not.toHaveBeenCalledWith(HUB_ROLES_URL, expect.anything())
  })

  it('says a refusal in the section of a role that went back to not filled, and a retry sends nothing', async () => {
    answerWith(catalog)
    mockApi.put.mockRejectedValueOnce(
      httpError(403, {
        detail: 'Only a HUB admin may change the admin set',
        code: 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
        params: { field: 'chat_switches' },
      })
    )
    const { container } = renderEdit({ chat_switches: null, home_plane: 'my_day' })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Заповнити налаштування чату' })
    )
    await userEvent.click(toggle('access'))
    expect((await save(container)).chat_switches).toBeDefined()

    const section = screen.getByRole('region', { name: 'Чат (HUB)' })
    expect(await within(section).findByText(ADMIN_ONLY)).toBeInTheDocument()
    expect(within(section).getByText(NOT_FILLED)).toBeInTheDocument()
    expectNoChatKeys(await save(container, 2))
  })

  it('keeps what was set and the controls when a catalogue refetch fails', async () => {
    // HOME_PLANE_UNKNOWN refetches the catalogue; this refetch fails.
    answerWith(catalog, httpError(500, { detail: 'boom' }))
    mockApi.put.mockRejectedValueOnce(
      httpError(422, {
        detail: 'Unknown HUB home screen.',
        code: 'HOME_PLANE_UNKNOWN',
        params: { home_plane: 'legal' },
      })
    )
    const { container } = renderEdit()
    await controlsReady()

    await userEvent.selectOptions(screen.getByLabelText(SCREEN), 'legal')
    await save(container)
    await waitFor(() =>
      expect(mockApi.get.mock.calls.filter(([url]) => url === HUB_ROLES_URL)).toHaveLength(2)
    )

    expect(screen.getByLabelText(SCREEN)).toHaveValue('legal')
    expect(toggle('access')).toBeEnabled()
  })

  it('explains why switches are locked, and points the locked controls at it', async () => {
    answerWith(catalog)
    renderEdit()
    await controlsReady()

    await userEvent.click(toggle('access'))

    const note = screen.getByText(
      'Доступ до чату вимкнено, тому решта перемикачів вимкнені й недоступні.'
    )
    expect(toggle('lead').getAttribute('aria-describedby')?.split(' ')).toContain(note.id)
    expect(toggle('access').getAttribute('aria-describedby')?.split(' ')).not.toContain(note.id)
  })

  it('gives each mounted section its own ids', async () => {
    answerWith(catalog)
    renderWithClient(
      <>
        <ViewRoleForm role={role()} projectName="Техно" />
        <EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />
      </>
    )
    await controlsReady()

    expect(screen.getAllByRole('region', { name: 'Чат (HUB)' })).toHaveLength(2)
    expect(screen.getByLabelText(SCREEN)).toHaveValue('operator')
  })
})

describe('CreateRoleForm - review round 1', () => {
  async function submit(container: HTMLElement, times: number) {
    fireEvent.submit(container.querySelector('form#create-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(times))
    return mockApi.post.mock.calls[times - 1][1] as Record<string, unknown>
  }

  async function fillIn(container: HTMLElement) {
    await userEvent.type(container.querySelector('#name') as HTMLInputElement, 'Андеррайтер')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'view_clients' }))
  }

  it('drops a refused template itself, even when the refetched catalogue still offers it', async () => {
    answerWith(catalog)
    mockApi.post.mockRejectedValueOnce(
      httpError(403, {
        detail: 'Only a HUB admin may use this template',
        code: 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
        params: { field: 'chat_template' },
      })
    )
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Шаблон прав чату/), 'operator')
    await fillIn(container)
    expect((await submit(container, 1)).chat_template).toBe('operator')

    const note = await screen.findByText(
      'Цю зміну налаштувань чату може зробити лише адміністратор HUB цього проєкту.'
    )
    expect(screen.getAllByRole('alert')).toEqual([note])
    await waitFor(() =>
      expect(mockApi.get.mock.calls.filter(([url]) => url === HUB_ROLES_URL)).toHaveLength(2)
    )
    expect(screen.getByLabelText(/Шаблон прав чату/)).toHaveValue('')
    expect(Object.keys(await submit(container, 2))).not.toContain('chat_template')
  })

  it('refetches the catalogue on an unknown template, which drops the pick', async () => {
    answerWith(catalog, {
      ...catalog,
      chat_templates: (catalog.chat_templates ?? []).filter((one) => one.code !== 'lawyer'),
    })
    mockApi.post.mockRejectedValueOnce(
      httpError(422, {
        detail: "Unknown chat template 'lawyer'.",
        code: 'CHAT_TEMPLATE_UNKNOWN',
        params: { chat_template: 'lawyer' },
      })
    )
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Шаблон прав чату/), 'lawyer')
    await fillIn(container)
    await submit(container, 1)

    expect(await screen.findByText('Такого шаблону прав чату немає. (lawyer)')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/Шаблон прав чату/)).toHaveValue(''))
    expect(
      within(screen.getByLabelText(/Шаблон прав чату/)).queryByRole('option', { name: 'Юрист' })
    ).toBeNull()
    expect(Object.keys(await submit(container, 2))).not.toContain('chat_template')
  })

  it('offers no template while acting as another user, says why, and sends none', async () => {
    signIn(['manage_roles'], true)
    answerWith({
      ...catalog,
      chat_templates: (catalog.chat_templates ?? []).map((one) => ({ ...one, assignable: false })),
    })
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    expect(
      await screen.findByText(
        'Під час роботи від імені іншого користувача шаблон прав чату обрати не можна: роль буде створено з незаповненими налаштуваннями чату.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Шаблон прав чату/)).toBeNull()
    expect(screen.queryByText(/потрібен адміністратор HUB/)).toBeNull()
    await fillIn(container)
    expect(Object.keys(await submit(container, 1))).not.toContain('chat_template')
  })
})
