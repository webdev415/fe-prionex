/**
 * «Роль у чаті (HUB)» leaves the role forms on a build with
 * VITE_ROLE_CHAT_SETTINGS_ENABLED on (board #1621, story 4), driven through
 * the real rolesApi against a stubbed HTTP client.
 *
 * With the flag off the field is as it was (KAN-1476), pinned by
 * EditRoleForm.hubRole.test.tsx. With it on the chat settings are the
 * switches, the screen and the template (RoleForm.chatSwitches tests); what is
 * pinned here is that the field is gone from all three forms for every state
 * of the catalogue - and that no form sends `hub_role`, a refetched role
 * included - plus the refusal words and the catalogue refresh after a
 * stale-catalogue refusal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

/** The old field's label, and its "not set" value - neither may be on screen. */
const OLD_LABEL = /Роль у чаті \(HUB\)/
const OLD_NOT_SET = 'Не задано — за назвою ролі'
/** HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN as uk/errors.json words it. */
const ADMIN_REFUSAL =
  'Цю зміну може зробити лише адміністратор HUB цього проєкту: вона стосується прав адміністратора HUB (роль «Адміністратор HUB», набір прав адміністратора або всі діалоги з клієнтами).'

const enabledCatalog: HubRoleCatalog = {
  mode: 'on',
  enabled: true,
  options: [
    { code: 'none', assignable: true },
    { code: 'employee', assignable: true },
    { code: 'operator', assignable: true },
    { code: 'admin', assignable: false },
  ],
  chat_templates: [
    { code: 'admin', assignable: false },
    { code: 'operator', assignable: true },
    { code: 'none', assignable: true },
  ],
  home_planes: ['operator', 'legal', 'training', 'quality', 'control', 'my_day'],
  client_dialog_values: ['none', 'my', 'department', 'all'],
}

const switchedOff: HubRoleCatalog = { ...enabledCatalog, mode: 'emit', enabled: false, options: [] }

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

type CatalogAnswer = HubRoleCatalog | Error

/** The catalogue answers in turn, the last answer repeating. */
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
    chat_switches: null,
    home_plane: 'my_day',
    chat_template: null,
    chat_set_follows_hub_role: true,
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
 * A missing field is only proof of anything once the catalogue has answered:
 * before that, the old field was hidden for every catalogue as well.
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

function expectNoOldField() {
  expect(screen.queryByLabelText(OLD_LABEL)).not.toBeInTheDocument()
  expect(screen.queryByText(OLD_LABEL)).not.toBeInTheDocument()
  expect(screen.queryByText(OLD_NOT_SET)).not.toBeInTheDocument()
  expect(document.querySelector('#hub_role')).toBeNull()
}

beforeEach(() => {
  vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'true')
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

describe('EditRoleForm - «Роль у чаті (HUB)» is gone', () => {
  it.each([
    ['enabled', enabledCatalog],
    ['switched off', switchedOff],
    ['unreachable', httpError(500, { detail: 'boom' })],
  ] as const)(
    'has no field and sends no hub_role while the catalogue is %s',
    async (_state, catalog) => {
      answerWith(catalog)
      const { container } = renderWithClient(
        <EditRoleForm role={role({ hub_role: 'lawyer' })} projectName="Техно" onSuccess={vi.fn()} />
      )

      await catalogueSettled()
      expectNoOldField()
      const body = await submitEdit(container)

      expect(Object.keys(body)).not.toContain('hub_role')
    }
  )

  /*
   * EditRoleModal shows the cached role detail at once and refetches it in the
   * background, so the form gets a new `role` while it is open. Whatever the
   * refetch brings, a save of permissions only sends no hub_role.
   */
  it('sends no hub_role for a role refetched while the form is open', async () => {
    answerWith(enabledCatalog)
    const { container, rerender } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'admin' })} projectName="Техно" onSuccess={vi.fn()} />
    )
    await catalogueSettled()

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
    expectNoOldField()
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

    await catalogueSettled()
    fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)

    expect(await screen.findByRole('alert')).toHaveTextContent(ADMIN_REFUSAL)
  })

  /*
   * The catalogue is cached for a minute; a refusal that means it is out of
   * date (here the admin guard) makes the form ask again, so what it offers
   * next - the chat templates' `assignable` among others - is fresh.
   */
  it('asks the catalogue again after a refusal that means it was out of date', async () => {
    answerWith(enabledCatalog)
    mockApi.put.mockRejectedValueOnce(
      httpError(403, {
        detail: 'Only a HUB admin may change the admin set',
        code: 'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
        params: { project_id: PROJECT, field: 'chat_switches' },
      })
    )
    const { container } = renderWithClient(
      <EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />
    )
    await catalogueSettled()

    await submitEdit(container)

    await waitFor(() =>
      expect(mockApi.get.mock.calls.filter(([url]) => url === HUB_ROLES_URL)).toHaveLength(2)
    )
  })
})

describe('CreateRoleForm - «Роль у чаті (HUB)» is gone', () => {
  async function fillAndSubmit(container: HTMLElement) {
    await userEvent.type(container.querySelector('#name') as HTMLInputElement, 'Андеррайтер')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'view_clients' }))
    fireEvent.submit(container.querySelector('form#create-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1))
    const [url, body] = mockApi.post.mock.calls[0]
    expect(url).toBe('/api/v1/admin/roles')
    return body as Record<string, unknown>
  }

  it.each([
    ['enabled', enabledCatalog],
    ['switched off', switchedOff],
    [
      'unreachable',
      Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }),
    ],
  ] as const)(
    'has no field and sends no hub_role while the catalogue is %s',
    async (_state, catalog) => {
      answerWith(catalog)
      const { container } = renderWithClient(
        <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
      )

      await catalogueSettled()
      expectNoOldField()
      const body = await fillAndSubmit(container)

      expect(Object.keys(body)).not.toContain('hub_role')
      expect(body.project_id).toBe(PROJECT)
    }
  )
})

describe('ViewRoleForm - «Роль у чаті (HUB)» is gone', () => {
  it('shows no HUB chat role row and does not ask the catalogue', async () => {
    answerWith(enabledCatalog)
    renderWithClient(<ViewRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" />)

    expect(await screen.findByText('Чат (HUB)')).toBeInTheDocument()
    expectNoOldField()
    expect(screen.queryByText('Оператор')).not.toBeInTheDocument()
    expect(mockApi.get).not.toHaveBeenCalledWith(HUB_ROLES_URL, expect.anything())
  })
})
