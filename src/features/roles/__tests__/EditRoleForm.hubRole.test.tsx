/**
 * «Роль у чаті (HUB)» in the role forms (KAN-1476), driven through the real
 * rolesApi against a stubbed HTTP client: what the forms show for each state of
 * the catalogue, and - above all - what they send.
 *
 * Board #1621, rule 28.5: this is the path of a build with
 * VITE_ROLE_CHAT_SETTINGS_ENABLED off (the default, PROD today) - the forms
 * as they were before the chat settings. The flag-on path, where the field is
 * gone, is RoleForm.hubRoleGone.test.tsx / RoleForm.chatSwitches.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { HubRoleCatalog, RoleDetailResponse } from '../types'

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
 * The forms are read in Ukrainian here, from the real uk/common.json: the
 * labels are the feature, so the assertions are on the words a person sees.
 * A key missing from the file falls back to the English default and fails.
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
const { rolesKeys } = await import('../hooks/useRoles')
const { ROLE_CHAT_SETTINGS_FLAG } = await import('../roleChatSettingsFlag')

const PROJECT = 5
const HUB_ROLES_URL = '/api/v1/admin/roles/hub-roles'

const LABEL = 'Роль у чаті (HUB)'
const NOT_SET = 'Не задано — за назвою ролі'
/*
 * The lock note for a value the catalogue marks not assignable. It names no
 * reason: the catalogue says only "not yours to choose now", and that is true
 * for a non-HUB-admin looking at admin and for anybody under impersonation.
 */
const LOCKED_NOT_ASSIGNABLE =
  'Це значення вам зараз недоступне для вибору, тож змінити його тут не можна.'
/**
 * HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN as uk/errors.json words it. Board #1621
 * widened the sentence (the API sends the code for the chat settings too);
 * it still names the «Адміністратор HUB» chat role this path refuses.
 */
const ADMIN_REFUSAL =
  'Цю зміну може зробити лише адміністратор HUB цього проєкту: вона стосується прав адміністратора HUB (роль «Адміністратор HUB», набір прав адміністратора або всі діалоги з клієнтами).'

const enabledCatalog: HubRoleCatalog = {
  mode: 'on',
  enabled: true,
  options: [
    { code: 'none', assignable: true },
    { code: 'employee', assignable: true },
    { code: 'training_workspace', assignable: true },
    { code: 'quality_workspace', assignable: true },
    { code: 'lawyer', assignable: true },
    { code: 'operator', assignable: true },
    { code: 'supervisor', assignable: true },
    { code: 'admin', assignable: false },
  ],
}

/** The same catalogue as a HUB admin of the project reads it: admin too. */
const hubAdminCatalog: HubRoleCatalog = {
  ...enabledCatalog,
  options: enabledCatalog.options.map((option) => ({ ...option, assignable: true })),
}

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

/**
 * Refusals are read through getErrorMessage -> i18next with the errors
 * namespace; this answers those lookups from the real uk/errors.json.
 */
async function speakUkrainianErrors() {
  const i18next = (await import('i18next')).default
  const ukErrors = (await import('@/../public/locales/uk/errors.json')).default as {
    codes: Record<string, string>
  }
  vi.spyOn(i18next, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
    options?.ns === 'errors' && key.startsWith('codes.')
      ? (ukErrors.codes[key.slice('codes.'.length)] ?? options.defaultValue)
      : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18next.t)
}

/** The HUB chat-role select as it is on screen now. */
const hubSelect = () => screen.getByLabelText(/Роль у чаті \(HUB\)/)

/** The catalogue without one code, as after HUB_ROLE_CHOICES dropped it. */
function catalogWithout(code: string): HubRoleCatalog {
  return {
    ...enabledCatalog,
    options: enabledCatalog.options.filter((option) => option.code !== code),
  }
}

type CatalogAnswer = HubRoleCatalog | Error

/**
 * The catalogue answers in turn, the last answer repeating: a test can have
 * the backend's mode change between two requests of the same form.
 */
function answerWith(...catalogs: [CatalogAnswer, ...CatalogAnswer[]]) {
  let asked = 0
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === HUB_ROLES_URL) {
      const catalog = catalogs[Math.min(asked, catalogs.length - 1)]
      asked += 1
      if (catalog instanceof Error) throw catalog
      return { data: catalog }
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
    hub_role: null,
    ...overrides,
  }
}

let queryClient: QueryClient

function renderWithClient(ui: ReactNode) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

/*
 * A hidden field is only proof of anything once the catalogue has answered:
 * before that, it is hidden for every catalogue. So the "hidden" tests wait
 * for the form to have asked - and for the answer to be in.
 */
async function catalogueSettled() {
  await waitFor(() => {
    const state = queryClient.getQueryState(rolesKeys.hubRoles(PROJECT))
    expect(state?.status === 'success' || state?.status === 'error').toBe(true)
  })
  expect(mockApi.get).toHaveBeenCalledWith(HUB_ROLES_URL, { params: { project_id: PROJECT } })
}

async function submitEdit(container: HTMLElement) {
  fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)
  await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1))
  const [url, body] = mockApi.put.mock.calls[0]
  expect(url).toBe('/api/v1/admin/roles/42')
  return body as Record<string, unknown>
}

beforeEach(() => {
  // The build of PROD today: the chat settings switched off.
  vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'false')
  mockApi.get.mockReset()
  mockApi.post.mockReset()
  mockApi.put.mockReset()
  mockApi.post.mockResolvedValue({ data: role() })
  mockApi.put.mockResolvedValue({ data: role() })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  // Restores the i18next.t spy of a test even when that test failed half way,
  // so no later test reads a stubbed translator.
  vi.restoreAllMocks()
})

describe('EditRoleForm - HUB chat role', () => {
  it('offers the catalogue with honest labels, the empty value first', async () => {
    answerWith(enabledCatalog)
    renderWithClient(<EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />)

    const select = await screen.findByLabelText(/Роль у чаті \(HUB\)/)
    const options = within(select).getAllByRole('option')

    expect(options.map((option) => option.textContent)).toEqual([
      NOT_SET,
      'Без доступу до HUB',
      'Співробітник (мінімальні права)',
      'Тренер (навчальний простір)',
      'Контроль якості (простір QA)',
      'Юрист',
      'Оператор',
      'Супервайзер',
      'Адміністратор HUB',
    ])
    expect(select).toHaveValue('')
    expect(screen.getByText(/Зміни діють у HUB протягом ~6 хв без повторного входу/)).toBeVisible()
  })

  it('disables an option the caller may not grant', async () => {
    answerWith(enabledCatalog)
    renderWithClient(<EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />)

    const select = await screen.findByLabelText(/Роль у чаті \(HUB\)/)

    expect(within(select).getByRole('option', { name: 'Адміністратор HUB' })).toBeDisabled()
    expect(within(select).getByRole('option', { name: 'Оператор' })).toBeEnabled()
  })

  it('sends the new value when it was changed', async () => {
    answerWith(enabledCatalog)
    const { container } = renderWithClient(
      <EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), 'operator')
    const body = await submitEdit(container)

    expect(body.hub_role).toBe('operator')
  })

  it('leaves hub_role out when the value was not touched', async () => {
    answerWith(enabledCatalog)
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'lawyer' })} projectName="Техно" onSuccess={vi.fn()} />
    )

    expect(await screen.findByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('lawyer')
    const body = await submitEdit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  /*
   * EditRoleModal shows the cached role detail at once and refetches it in the
   * background, so the form gets a new `role` while it is open. Another HUB
   * admin may have changed the HUB role in between: the form must follow the
   * stored value nobody touched here. Copying it once at mount sent the old
   * value back with a save of permissions only - granting HUB admin again.
   */
  it('follows a stored value refetched while the form is open, and sends none of it', async () => {
    answerWith(hubAdminCatalog)
    const { container, rerender } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'admin' })} projectName="Техно" onSuccess={vi.fn()} />
    )
    expect(await screen.findByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('admin')

    rerender(
      <QueryClientProvider client={queryClient}>
        <EditRoleForm
          role={role({ hub_role: 'operator' })}
          projectName="Техно"
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>
    )
    const body = await submitEdit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
    expect(screen.getByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('operator')
  })

  /*
   * A value somebody DID pick is theirs to send, refetch or not. Against HEAD
   * it fails like every test here (there is no field). Against the refetch
   * fix above it is a regression pin: that fix must not become "reset the
   * select whenever the role is refetched", which would throw the pick away.
   * Mutation control: a useEffect that resets the select on every change of
   * the stored value fails it.
   */
  it('keeps a value somebody picked when the role is refetched under it', async () => {
    answerWith(hubAdminCatalog)
    const { container, rerender } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'admin' })} projectName="Техно" onSuccess={vi.fn()} />
    )
    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), 'supervisor')

    rerender(
      <QueryClientProvider client={queryClient}>
        <EditRoleForm
          role={role({ hub_role: 'operator' })}
          projectName="Техно"
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>
    )
    expect(screen.getByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('supervisor')
    const body = await submitEdit(container)

    expect(body.hub_role).toBe('supervisor')
  })

  it('sends an explicit null when a stored value is cleared', async () => {
    answerWith(enabledCatalog)
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'lawyer' })} projectName="Техно" onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), '')
    const body = await submitEdit(container)

    expect(Object.keys(body)).toContain('hub_role')
    expect(body.hub_role).toBeNull()
  })

  it('hides the field and never sends hub_role while the catalogue is switched off', async () => {
    answerWith({ mode: 'emit', enabled: false, options: [] })
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'lawyer' })} projectName="Техно" onSuccess={vi.fn()} />
    )

    await catalogueSettled()
    expect(screen.queryByLabelText(/Роль у чаті \(HUB\)/)).not.toBeInTheDocument()
    const body = await submitEdit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  it('hides the field and never sends hub_role when the catalogue answers 500', async () => {
    answerWith(httpError(500, { detail: 'boom' }))
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'lawyer' })} projectName="Техно" onSuccess={vi.fn()} />
    )

    await catalogueSettled()
    expect(screen.queryByLabelText(/Роль у чаті \(HUB\)/)).not.toBeInTheDocument()
    const body = await submitEdit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  it('keeps a stored value the catalogue does not offer, shown as unavailable', async () => {
    answerWith({
      ...enabledCatalog,
      options: enabledCatalog.options.filter((option) => option.code !== 'quality_workspace'),
    })
    const { container } = renderWithClient(
      <EditRoleForm
        role={role({ hub_role: 'quality_workspace' })}
        projectName="Техно"
        onSuccess={vi.fn()}
      />
    )

    const select = await screen.findByLabelText(/Роль у чаті \(HUB\)/)
    const held = within(select).getByRole('option', {
      name: 'quality_workspace (недоступно для вибору)',
    })

    expect(held).toBeDisabled()
    expect(select).toHaveValue('quality_workspace')
    const body = await submitEdit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  it('shows a default role read only, explains why, and never sends it', async () => {
    answerWith(enabledCatalog)
    const { container } = renderWithClient(
      <EditRoleForm
        role={role({ name: 'Operator', is_default: true, hub_role: 'operator' })}
        projectName="Техно"
        onSuccess={vi.fn()}
      />
    )

    const select = await screen.findByLabelText(/Роль у чаті \(HUB\)/)

    expect(select).toBeDisabled()
    expect(select).toHaveValue('operator')
    expect(select).toHaveAccessibleDescription(
      'Роль за замовчуванням: роль у чаті задає система, тут її не змінити.'
    )
    const body = await submitEdit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  it('locks a stored admin value for a caller who may not grant it', async () => {
    answerWith(enabledCatalog)
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'admin' })} projectName="Техно" onSuccess={vi.fn()} />
    )

    const select = await screen.findByLabelText(/Роль у чаті \(HUB\)/)

    expect(select).toBeDisabled()
    expect(select).toHaveAccessibleDescription(LOCKED_NOT_ASSIGNABLE)
    const body = await submitEdit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  /*
   * Under impersonation the backend marks EVERY option not assignable
   * (HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING on a write). The value is locked,
   * but the note must not invent a reason the catalogue never gave - "only a
   * HUB admin" is false for a HUB admin who is impersonating.
   */
  it('names no reason of its own when the catalogue closes every option', async () => {
    answerWith({
      ...enabledCatalog,
      options: enabledCatalog.options.map((option) => ({ ...option, assignable: false })),
    })
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" onSuccess={vi.fn()} />
    )

    const select = await screen.findByLabelText(/Роль у чаті \(HUB\)/)

    expect(select).toBeDisabled()
    expect(select).toHaveAccessibleDescription(LOCKED_NOT_ASSIGNABLE)
    expect(screen.queryByText(/адміністратор HUB/)).not.toBeInTheDocument()
    const body = await submitEdit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  /*
   * A custom role «Administrator» with no value is HUB admin by its name - for
   * HUB and for the backend guard alike (effective_hub_role). The form does
   * not copy that rule (rule 27; the aliases are to go, CEO decision 8), so
   * the field stays open to a caller who may not grant admin. What such a
   * caller picks takes HUB admin away and is refused: the refusal is said in
   * words, the pick is dropped, and the retry of the same save goes through
   * with the permissions and without the refused value.
   */
  it('leaves a role named Administrator open, says the refusal in words and drops the pick for the retry', async () => {
    await speakUkrainianErrors()
    answerWith(enabledCatalog)
    mockApi.put.mockRejectedValueOnce(
      httpError(403, {
        detail: 'Only a HUB admin may grant or remove admin',
        code: 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
      })
    )
    const { container } = renderWithClient(
      <EditRoleForm
        role={role({ name: ' Administrator ', hub_role: null })}
        projectName="Техно"
        onSuccess={vi.fn()}
      />
    )

    const select = await screen.findByLabelText(/Роль у чаті \(HUB\)/)
    expect(select).toBeEnabled()
    expect(select).not.toHaveAttribute('aria-describedby')
    await userEvent.selectOptions(select, 'operator')
    const refused = await submitEdit(container)
    expect(refused.hub_role).toBe('operator')

    expect(await screen.findByRole('alert')).toHaveTextContent(ADMIN_REFUSAL)
    await waitFor(() => expect(hubSelect()).toHaveValue(''))
    fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(2))

    expect(Object.keys(mockApi.put.mock.calls[1][1] as object)).not.toContain('hub_role')
  })

  /*
   * The catalogue is cached for a minute. When the backend's mode is rolled
   * back (on -> emit) inside that minute, the form still offers the field and
   * the save is refused with HUB_ROLE_DISABLED - permissions and all. The
   * refusal must make the form ask again, so the field goes and a retry of
   * the very same save goes through without hub_role.
   */
  it('asks the catalogue again after a save refused as switched off, so a retry passes', async () => {
    answerWith(enabledCatalog, { mode: 'emit', enabled: false, options: [] })
    mockApi.put.mockRejectedValueOnce(
      httpError(422, {
        detail: 'hub_role cannot be written while HUB_ROLE_MODE is emit',
        code: 'HUB_ROLE_DISABLED',
      })
    )
    const { container } = renderWithClient(
      <EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), 'operator')
    const refused = await submitEdit(container)
    expect(refused.hub_role).toBe('operator')

    await waitFor(() =>
      expect(screen.queryByLabelText(/Роль у чаті \(HUB\)/)).not.toBeInTheDocument()
    )
    fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(2))

    expect(Object.keys(mockApi.put.mock.calls[1][1] as object)).not.toContain('hub_role')
  })

  /*
   * HUB_ROLE_UNKNOWN: the value left the catalogue while the form was open.
   * The refetch that follows no longer offers it. The select must not keep a
   * value it has no option for - the browser would show «Не задано» while the
   * retry sent the refused code again, to be refused again.
   */
  it('shows the stored value, and does not send the pick again, after a save refused as unknown', async () => {
    answerWith(enabledCatalog, catalogWithout('lawyer'))
    mockApi.put.mockRejectedValueOnce(
      httpError(422, {
        detail: "hub_role 'lawyer' is not in HUB_ROLE_CHOICES",
        code: 'HUB_ROLE_UNKNOWN',
      })
    )
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), 'lawyer')
    const refused = await submitEdit(container)
    expect(refused.hub_role).toBe('lawyer')

    await waitFor(() =>
      expect(within(hubSelect()).queryByRole('option', { name: 'Юрист' })).not.toBeInTheDocument()
    )
    expect(hubSelect()).toHaveValue('operator')
    fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(2))

    expect(Object.keys(mockApi.put.mock.calls[1][1] as object)).not.toContain('hub_role')
  })

  /*
   * The catalogue said admin was the caller's to grant - a minute ago. The
   * save is refused (HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN) and the refetch marks
   * admin not assignable. A pick kept past that would stay selected as a
   * disabled option and be sent again.
   */
  it('drops a pick of admin that the refreshed catalogue no longer lets the caller grant', async () => {
    answerWith(hubAdminCatalog, enabledCatalog)
    mockApi.put.mockRejectedValueOnce(
      httpError(403, {
        detail: 'Only a HUB admin may grant admin',
        code: 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
      })
    )
    const { container } = renderWithClient(
      <EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), 'admin')
    const refused = await submitEdit(container)
    expect(refused.hub_role).toBe('admin')

    await waitFor(() =>
      expect(within(hubSelect()).getByRole('option', { name: 'Адміністратор HUB' })).toBeDisabled()
    )
    expect(hubSelect()).toHaveValue('')
    fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(2))

    expect(Object.keys(mockApi.put.mock.calls[1][1] as object)).not.toContain('hub_role')
  })

  /*
   * No refusal needed: the catalogue is refetched under an open form for
   * reasons of its own (window focus, a minute gone). A pick the new answer
   * no longer offers falls back to the stored value, on screen and in the
   * save alike.
   */
  it('falls back to the stored value when a refetch of the catalogue drops the pick', async () => {
    answerWith(enabledCatalog, catalogWithout('lawyer'))
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" onSuccess={vi.fn()} />
    )
    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), 'lawyer')
    expect(hubSelect()).toHaveValue('lawyer')

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.hubRolesAll() })
    })
    await waitFor(() =>
      expect(within(hubSelect()).queryByRole('option', { name: 'Юрист' })).not.toBeInTheDocument()
    )

    expect(hubSelect()).toHaveValue('operator')
    const body = await submitEdit(container)
    expect(Object.keys(body)).not.toContain('hub_role')
  })

  it('shows a refusal in the words of errors.json, not the transport text', async () => {
    await speakUkrainianErrors()
    answerWith(enabledCatalog)
    mockApi.put.mockRejectedValue(
      httpError(403, {
        detail: 'Only a HUB admin may grant admin',
        code: 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
      })
    )
    const { container } = renderWithClient(
      <EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), 'operator')
    fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)

    expect(await screen.findByRole('alert')).toHaveTextContent(ADMIN_REFUSAL)
  })
})

describe('CreateRoleForm - HUB chat role', () => {
  async function fillAndSubmit(container: HTMLElement) {
    await userEvent.type(container.querySelector('#name') as HTMLInputElement, 'Андеррайтер')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'view_clients' }))
    fireEvent.submit(container.querySelector('form#create-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1))
    const [url, body] = mockApi.post.mock.calls[0]
    expect(url).toBe('/api/v1/admin/roles')
    return body as Record<string, unknown>
  }

  it('sends the chosen HUB role with the new role', async () => {
    answerWith(enabledCatalog)
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Роль у чаті \(HUB\)/), 'none')
    const body = await fillAndSubmit(container)

    expect(body.hub_role).toBe('none')
    expect(body.project_id).toBe(PROJECT)
  })

  it('leaves hub_role out when nothing was chosen', async () => {
    answerWith(enabledCatalog)
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    expect(await screen.findByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('')
    const body = await fillAndSubmit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  it('hides the field and sends no hub_role while the catalogue is switched off', async () => {
    answerWith({ mode: 'off', enabled: false, options: [] })
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await catalogueSettled()
    expect(screen.queryByLabelText(/Роль у чаті \(HUB\)/)).not.toBeInTheDocument()
    const body = await fillAndSubmit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })

  /*
   * The refetch after the refusal no longer offers the picked value. The
   * select must then show - and the retry send - "not set", not keep the
   * refused code behind a first option it has no match for.
   */
  it('asks the catalogue again after a create refused for a value it no longer knows, and does not send it again', async () => {
    answerWith(enabledCatalog, catalogWithout('lawyer'))
    mockApi.post.mockRejectedValueOnce(
      httpError(422, {
        detail: "hub_role 'lawyer' is not in HUB_ROLE_CHOICES",
        code: 'HUB_ROLE_UNKNOWN',
      })
    )
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    const select = await screen.findByLabelText(/Роль у чаті \(HUB\)/)
    await userEvent.selectOptions(select, 'lawyer')
    const refused = await fillAndSubmit(container)
    expect(refused.hub_role).toBe('lawyer')

    await waitFor(() =>
      expect(within(hubSelect()).queryByRole('option', { name: 'Юрист' })).not.toBeInTheDocument()
    )
    expect(mockApi.get.mock.calls.filter(([url]) => url === HUB_ROLES_URL)).toHaveLength(2)
    expect(hubSelect()).toHaveValue('')

    fireEvent.submit(container.querySelector('form#create-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(2))
    const retried = mockApi.post.mock.calls[1][1] as Record<string, unknown>
    expect(retried.name).toBe('Андеррайтер')
    expect(Object.keys(retried)).not.toContain('hub_role')
  })

  it('hides the field and sends no hub_role when the catalogue is unreachable', async () => {
    answerWith(
      Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })
    )
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await catalogueSettled()
    expect(screen.queryByLabelText(/Роль у чаті \(HUB\)/)).not.toBeInTheDocument()
    const body = await fillAndSubmit(container)

    expect(Object.keys(body)).not.toContain('hub_role')
  })
})

describe('ViewRoleForm - HUB chat role', () => {
  it('names the stored value from the catalogue', async () => {
    answerWith(enabledCatalog)
    renderWithClient(<ViewRoleForm role={role({ hub_role: 'none' })} projectName="Техно" />)

    expect(await screen.findByText('Без доступу до HUB')).toBeInTheDocument()
    expect(screen.getByText(`${LABEL}:`)).toBeInTheDocument()
  })

  it('reads an empty value as "not set", never as minimal rights', async () => {
    answerWith(enabledCatalog)
    renderWithClient(<ViewRoleForm role={role({ hub_role: null })} projectName="Техно" />)

    await catalogueSettled()
    expect(screen.getByText(NOT_SET)).toBeInTheDocument()
    expect(screen.queryByText(/мінімальні права/)).not.toBeInTheDocument()
  })

  it('shows the raw code with a note when the catalogue is unavailable', async () => {
    answerWith(httpError(503))
    renderWithClient(<ViewRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" />)

    await catalogueSettled()
    expect(screen.getByText('operator')).toBeInTheDocument()
    expect(screen.getByText('(каталог HUB недоступний)')).toBeInTheDocument()
  })

  it('shows the row only when the backend sends the field', async () => {
    answerWith(enabledCatalog)
    const legacy = role()
    delete (legacy as { hub_role?: unknown }).hub_role
    const { unmount } = renderWithClient(<ViewRoleForm role={legacy} projectName="Техно" />)

    expect(screen.queryByText(`${LABEL}:`)).not.toBeInTheDocument()
    expect(mockApi.get).not.toHaveBeenCalledWith(HUB_ROLES_URL, expect.anything())
    unmount()

    renderWithClient(<ViewRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" />)

    expect(screen.getByText(`${LABEL}:`)).toBeInTheDocument()
    expect(await screen.findByText('Оператор')).toBeInTheDocument()
  })
})
