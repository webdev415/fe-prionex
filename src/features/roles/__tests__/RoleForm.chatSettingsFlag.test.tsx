/**
 * The two builds of the role forms, side by side (board #1621, story 4,
 * rule 28.5): VITE_ROLE_CHAT_SETTINGS_ENABLED decides which HUB chat rights a
 * form shows and sends.
 *
 * - off (the default, PROD today): «Роль у чаті (HUB)» as before story 4, and
 *   the forms send `hub_role`; no chat section, no template, no chat keys;
 * - on: the «Чат (HUB)» section / the chat template, and `hub_role` is never
 *   sent.
 *
 * The same backend answers both - it already knows the chat settings (story
 * 2b) - so what differs is the build alone. The details of each path are in
 * EditRoleForm.hubRole.test.tsx (off) and RoleForm.chatSwitches.test.tsx /
 * RoleForm.hubRoleGone.test.tsx (on).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

/* The forms are read in Ukrainian, from the real uk/common.json. */
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
const OLD_FIELD = /Роль у чаті \(HUB\)/
const SECTION = { name: 'Чат (HUB)' } as const
const TEMPLATE = /Шаблон прав чату/
const CHAT_KEYS = ['chat_switches', 'home_plane', 'chat_template']

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

/** A catalogue that offers both: the HUB chat role and the chat values. */
const catalog: HubRoleCatalog = {
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
    chat_switches: { ...OPERATOR },
    home_plane: 'operator',
    chat_template: null,
    chat_set_follows_hub_role: true,
    ...overrides,
  }
}

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function keysOf(body: unknown): string[] {
  return Object.keys(body as Record<string, unknown>)
}

beforeEach(() => {
  mockApi.get.mockReset()
  mockApi.post.mockReset()
  mockApi.put.mockReset()
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === HUB_ROLES_URL) return { data: catalog }
    if (url === '/api/v1/admin/permissions') {
      return {
        data: {
          permissions: [{ id: 1, code: 'view_clients', name: 'view_clients', category: 'Clients' }],
        },
      }
    }
    throw new Error(`unexpected GET ${url}`)
  })
  mockApi.post.mockResolvedValue({ data: role() })
  mockApi.put.mockResolvedValue({ data: role() })
  // A role manager who is not impersonating: both paths have their controls.
  useAuthStore.setState({
    user: { id: '1', permissions: ['manage_roles'] } as unknown as User,
    isImpersonating: false,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  useAuthStore.setState({ user: null, isImpersonating: false })
  vi.clearAllMocks()
})

describe('chat settings flag off (unset - PROD today): the forms as before story 4', () => {
  it.each([undefined, 'false', ''])('treats %o as off', async (value) => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, value as unknown as string)
    renderWithClient(<EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />)

    expect(await screen.findByLabelText(OLD_FIELD)).toBeInTheDocument()
    expect(screen.queryByRole('region', SECTION)).not.toBeInTheDocument()
  })

  it('edit: shows «Роль у чаті (HUB)» and no chat section, and sends the picked hub_role', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'false')
    const { container } = renderWithClient(
      <EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(OLD_FIELD), 'operator')
    expect(screen.queryByRole('region', SECTION)).not.toBeInTheDocument()
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1))
    const [, body] = mockApi.put.mock.calls[0]

    expect((body as Record<string, unknown>).hub_role).toBe('operator')
    for (const key of CHAT_KEYS) expect(keysOf(body)).not.toContain(key)
  })

  it('create: shows «Роль у чаті (HUB)» and no template, and sends the picked hub_role', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'false')
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(OLD_FIELD), 'operator')
    expect(screen.queryByLabelText(TEMPLATE)).not.toBeInTheDocument()
    await userEvent.type(container.querySelector('#name') as HTMLInputElement, 'Андеррайтер')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'view_clients' }))
    fireEvent.submit(container.querySelector('form#create-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1))
    const [, body] = mockApi.post.mock.calls[0]

    expect((body as Record<string, unknown>).hub_role).toBe('operator')
    for (const key of CHAT_KEYS) expect(keysOf(body)).not.toContain(key)
  })

  it('view: shows the HUB chat role row and no chat section', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'false')
    renderWithClient(<ViewRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" />)

    expect(await screen.findByText('Роль у чаті (HUB):')).toBeInTheDocument()
    expect(await screen.findByText('Оператор')).toBeInTheDocument()
    expect(screen.queryByRole('region', SECTION)).not.toBeInTheDocument()
    expect(mockApi.get).toHaveBeenCalledWith(HUB_ROLES_URL, { params: { project_id: PROJECT } })
  })
})

describe('chat settings flag on: the chat settings instead of «Роль у чаті (HUB)»', () => {
  it.each(['true', '1'])('treats %o as on', async (value) => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, value)
    renderWithClient(<EditRoleForm role={role()} projectName="Техно" onSuccess={vi.fn()} />)

    expect(await screen.findByRole('region', SECTION)).toBeInTheDocument()
    expect(screen.queryByLabelText(OLD_FIELD)).not.toBeInTheDocument()
  })

  it('edit: shows the chat section and no «Роль у чаті (HUB)», and never sends hub_role', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'true')
    const { container } = renderWithClient(
      <EditRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" onSuccess={vi.fn()} />
    )

    await userEvent.click(await screen.findByRole('switch', { name: 'Права керівника' }))
    expect(screen.queryByLabelText(OLD_FIELD)).not.toBeInTheDocument()
    fireEvent.submit(container.querySelector('form#edit-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1))
    const [, body] = mockApi.put.mock.calls[0]

    expect((body as Record<string, unknown>).chat_switches).toEqual({ ...OPERATOR, lead: true })
    expect((body as Record<string, unknown>).home_plane).toBe('operator')
    expect(keysOf(body)).not.toContain('hub_role')
  })

  it('create: shows the template and no «Роль у чаті (HUB)», and never sends hub_role', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'true')
    const { container } = renderWithClient(
      <CreateRoleForm projectId={PROJECT} onSuccess={vi.fn()} />
    )

    await userEvent.selectOptions(await screen.findByLabelText(TEMPLATE), 'operator')
    expect(screen.queryByLabelText(OLD_FIELD)).not.toBeInTheDocument()
    await userEvent.type(container.querySelector('#name') as HTMLInputElement, 'Андеррайтер')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'view_clients' }))
    fireEvent.submit(container.querySelector('form#create-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1))
    const [, body] = mockApi.post.mock.calls[0]

    expect((body as Record<string, unknown>).chat_template).toBe('operator')
    expect(keysOf(body)).not.toContain('hub_role')
  })

  it('view: shows the chat section, no HUB chat role row, and asks no catalogue', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'true')
    renderWithClient(<ViewRoleForm role={role({ hub_role: 'operator' })} projectName="Техно" />)

    expect(await screen.findByRole('region', SECTION)).toBeInTheDocument()
    expect(screen.queryByText('Роль у чаті (HUB):')).not.toBeInTheDocument()
    expect(mockApi.get).not.toHaveBeenCalledWith(HUB_ROLES_URL, expect.anything())
  })
})
