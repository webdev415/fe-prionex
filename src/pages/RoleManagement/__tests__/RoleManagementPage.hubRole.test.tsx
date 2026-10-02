/**
 * The roles table's «Роль у чаті (HUB)» column (KAN-1476), and its «Чат (HUB)»
 * column (board #1621) on a build with VITE_ROLE_CHAT_SETTINGS_ENABLED on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ApiRole, HubRoleCatalog } from '@/features/roles/types'

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))

// The real module behind the stubbed client: the role forms read the auth
// store (manage_roles, impersonation), which wires itself to the api module.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: mockApi,
  default: mockApi,
}))

vi.mock('@/features/projects', () => ({
  useProjects: () => ({
    data: { projects: [{ id: 5, name: 'Техно' }] },
    isLoading: false,
  }),
}))

vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => children,
}))

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
  const t = (key: string, second?: unknown) => {
    const found = lookup(key)
    if (typeof found === 'string') return found
    if (typeof second === 'string') return second
    return key
  }
  return {
    useTranslation: () => ({ t, i18n: { language: 'uk', changeLanguage: vi.fn() } }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

const { RoleManagementPage } = await import('../RoleManagementPage')
const { ROLE_CHAT_SETTINGS_FLAG } = await import('@/features/roles/roleChatSettingsFlag')

const HUB_ROLES_URL = '/api/v1/admin/roles/hub-roles'

function apiRole(overrides: Partial<ApiRole>): ApiRole {
  return {
    id: 1,
    project_id: 5,
    name: 'Admin',
    description: '',
    is_default: true,
    is_active: true,
    permission_count: 10,
    user_count: 2,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

const catalog: HubRoleCatalog = {
  mode: 'on',
  enabled: true,
  options: [
    { code: 'none', assignable: true },
    { code: 'employee', assignable: true },
    { code: 'operator', assignable: true },
    { code: 'admin', assignable: true },
  ],
}

function answerWith(roles: ApiRole[], hubCatalog: HubRoleCatalog | Error) {
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/admin/roles') {
      return {
        data: {
          roles,
          pagination: { page: 1, page_size: 100, total_count: roles.length, total_pages: 1 },
        },
      }
    }
    if (url === HUB_ROLES_URL) {
      if (hubCatalog instanceof Error) throw hubCatalog
      return { data: hubCatalog }
    }
    throw new Error(`unexpected GET ${url}`)
  })
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <RoleManagementPage />
    </QueryClientProvider>
  )
}

const withHubRole = [
  apiRole({ id: 1, name: 'Admin', is_default: true, hub_role: 'admin' }),
  apiRole({ id: 2, name: 'Андеррайтер', is_default: false, hub_role: null }),
  apiRole({ id: 3, name: 'Тестова', is_default: false, hub_role: 'none' }),
]

beforeEach(() => {
  mockApi.get.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('RoleManagementPage - HUB chat role column', () => {
  it('names each role’s HUB chat role, and an empty one as "not set"', async () => {
    answerWith(withHubRole, catalog)
    renderPage()

    const underwriter = (await screen.findByText('Андеррайтер')).closest('tr') as HTMLElement
    await waitFor(() =>
      expect(within(underwriter).getByText('Не задано — за назвою ролі')).toBeInTheDocument()
    )
    const admin = screen.getByText('Admin').closest('tr') as HTMLElement
    const blocked = screen.getByText('Тестова').closest('tr') as HTMLElement

    expect(screen.getAllByText('Роль у чаті (HUB)').length).toBeGreaterThan(0)
    await waitFor(() => expect(within(admin).getByText('Адміністратор HUB')).toBeInTheDocument())
    expect(within(blocked).getByText('Без доступу до HUB')).toBeInTheDocument()
    expect(mockApi.get).toHaveBeenCalledWith(HUB_ROLES_URL, { params: { project_id: 5 } })
  })

  it('shows raw codes with a note while the catalogue is unavailable', async () => {
    answerWith(
      withHubRole,
      Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500 } })
    )
    renderPage()

    const admin = (await screen.findByText('Admin')).closest('tr') as HTMLElement
    await waitFor(() =>
      expect(within(admin).getByText('(каталог HUB недоступний)')).toBeInTheDocument()
    )
    expect(within(admin).getByText('admin')).toBeInTheDocument()
  })

  it('has the column only when the backend sends the field', async () => {
    answerWith(
      withHubRole.map(({ hub_role: _dropped, ...rest }) => rest as ApiRole),
      catalog
    )
    const { unmount } = renderPage()

    await screen.findByText('Андеррайтер')

    expect(screen.queryByText('Роль у чаті (HUB)')).not.toBeInTheDocument()
    expect(mockApi.get).not.toHaveBeenCalledWith(HUB_ROLES_URL, expect.anything())
    unmount()

    answerWith(withHubRole, catalog)
    renderPage()

    await screen.findByText('Андеррайтер')
    expect(screen.getAllByText('Роль у чаті (HUB)').length).toBeGreaterThan(0)
  })
})

const withChatAccess = [
  apiRole({ id: 1, name: 'Admin', is_default: true, hub_role: 'admin', chat_access: true }),
  apiRole({
    id: 2,
    name: 'Андеррайтер',
    description: 'Перевіряє заявки',
    is_default: false,
    hub_role: 'operator',
    chat_access: null,
  }),
  apiRole({
    id: 3,
    name: 'Тестова',
    is_default: false,
    hub_role: 'none',
    chat_access: false,
  }),
]

describe('RoleManagementPage - chat access column, chat settings flag off', () => {
  it('has no «Чат (HUB)» column even when the backend sends the field', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'false')
    answerWith(withChatAccess, catalog)
    renderPage()

    await screen.findByText('Андеррайтер')
    expect(screen.getAllByText('Роль у чаті (HUB)').length).toBeGreaterThan(0)
    expect(screen.queryByText('Чат (HUB)')).not.toBeInTheDocument()
  })
})

describe('RoleManagementPage - chat access column (board #1621), chat settings flag on', () => {
  beforeEach(() => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'true')
  })

  it('says per role whether it has chat access, and «—» while it is not filled', async () => {
    answerWith(withChatAccess, catalog)
    renderPage()

    const underwriter = (await screen.findByText('Андеррайтер')).closest('tr') as HTMLElement
    const admin = screen.getByText('Admin').closest('tr') as HTMLElement
    const blocked = screen.getByText('Тестова').closest('tr') as HTMLElement

    expect(screen.getAllByText('Чат (HUB)').length).toBeGreaterThan(0)
    expect(within(admin).getByText('так')).toBeInTheDocument()
    expect(within(blocked).getByText('ні')).toBeInTheDocument()
    expect(within(underwriter).getByText('—')).toBeInTheDocument()
  })

  it('has the column only when the backend sends the field', async () => {
    // withHubRole carries no chat_access: a backend that predates the field.
    answerWith(withHubRole, catalog)
    renderPage()

    await screen.findByText('Андеррайтер')
    expect(screen.getAllByText('Роль у чаті (HUB)').length).toBeGreaterThan(0)
    expect(screen.queryByText('Чат (HUB)')).not.toBeInTheDocument()
  })
})
