/**
 * EditRoleModal on the path a stale role detail really takes (KAN-1476;
 * chat settings board #1621, story 4).
 *
 * The modal renders the cached role detail at once and refetches it in the
 * background; the refetch hands the open form a new `role`. When another
 * admin changed the role's HUB chat rights in between, a save of permissions
 * only must not write the cached ones back - that would silently grant the
 * old rights again. Both builds (VITE_ROLE_CHAT_SETTINGS_ENABLED): off, the
 * HUB chat role (no hub_role); on, the chat settings - «Роль у чаті (HUB)»
 * left the form, so no hub_role either.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ChatSwitches, HubRoleCatalog, RoleDetailResponse } from '@/features/roles/types'
import type { User } from '@/types/api'

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))

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
    Trans: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

const { EditRoleModal } = await import('../components/EditRoleModal')
const { useAuthStore } = await import('@/stores/authStore')
const { rolesKeys } = await import('@/features/roles/hooks/useRoles')
const { projectsKeys } = await import('@/features/projects/hooks/useProjects')
const { ROLE_CHAT_SETTINGS_FLAG } = await import('@/features/roles/roleChatSettingsFlag')

const PROJECT = 5
const ROLE_ID = 42
const ROLE_URL = `/api/v1/admin/roles/${ROLE_ID}`

/** The catalogue as a HUB admin of the project reads it: admin is assignable. */
const hubAdminCatalog: HubRoleCatalog = {
  mode: 'on',
  enabled: true,
  options: [
    { code: 'none', assignable: true },
    { code: 'employee', assignable: true },
    { code: 'operator', assignable: true },
    { code: 'supervisor', assignable: true },
    { code: 'admin', assignable: true },
  ],
  chat_templates: [{ code: 'operator', assignable: true }],
  home_planes: ['operator', 'legal', 'training', 'quality', 'control', 'my_day'],
  client_dialog_values: ['none', 'my', 'department', 'all'],
}

const ADMIN_SWITCHES: ChatSwitches = {
  access: true,
  client_dialogs: 'all',
  create_groups: true,
  dept_channel_admin: true,
  download_files: true,
  ai_assistant: true,
  chat_only: false,
  lead: true,
}

const OPERATOR_SWITCHES: ChatSwitches = {
  ...ADMIN_SWITCHES,
  client_dialogs: 'my',
  dept_channel_admin: false,
  lead: false,
}

function role(
  hubRole: string | null,
  switches: ChatSwitches,
  homePlane: string
): RoleDetailResponse {
  return {
    id: ROLE_ID,
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
    hub_role: hubRole,
    chat_switches: switches,
    home_plane: homePlane,
    chat_template: hubRole,
    chat_set_follows_hub_role: true,
  }
}

beforeEach(() => {
  mockApi.get.mockReset()
  mockApi.put.mockReset()
  mockApi.put.mockResolvedValue({ data: role('operator', OPERATOR_SWITCHES, 'operator') })
  // A role manager: the chat section has its controls.
  useAuthStore.setState({ user: { id: '1', permissions: ['manage_roles'] } as unknown as User })
})

afterEach(() => {
  vi.unstubAllEnvs()
  useAuthStore.setState({ user: null })
})

/**
 * Opens the modal on the cached detail of an admin role, with the refetch of
 * the detail held until the test answers it. Returns the answer.
 */
function openOnCachedAdmin(): {
  queryClient: QueryClient
  answerRefetch: (detail: RoleDetailResponse) => void
} {
  let answer: (detail: RoleDetailResponse) => void = () => undefined
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === ROLE_URL) {
      // Held until the form is on screen with the cached detail.
      return new Promise((resolve) => {
        answer = (detail) => resolve({ data: detail })
      })
    }
    if (url === '/api/v1/admin/roles/hub-roles') return { data: hubAdminCatalog }
    if (url === `/api/v1/projects/${PROJECT}`) return { data: { id: PROJECT, name: 'Техно' } }
    if (url === '/api/v1/admin/permissions') {
      return {
        data: {
          permissions: [{ id: 1, code: 'view_clients', name: 'view_clients', category: 'Clients' }],
        },
      }
    }
    throw new Error(`unexpected GET ${url}`)
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // Opened View a while ago: the detail, admin in HUB, is in the cache.
  queryClient.setQueryData(rolesKeys.detail(ROLE_ID), role('admin', ADMIN_SWITCHES, 'control'))
  queryClient.setQueryData(projectsKeys.detail(PROJECT), { id: PROJECT, name: 'Техно' })

  render(
    <QueryClientProvider client={queryClient}>
      <EditRoleModal open roleId={ROLE_ID} onClose={vi.fn()} onSuccess={vi.fn()} />
    </QueryClientProvider>
  )
  return { queryClient, answerRefetch: (detail) => answer(detail) }
}

describe('EditRoleModal - HUB chat role of a refetched role (chat settings flag off)', () => {
  it('saves permissions without writing back the cached HUB role the refetch replaced', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'false')
    const { queryClient, answerRefetch } = openOnCachedAdmin()
    expect(await screen.findByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('admin')
    expect(screen.queryByText('Чат (HUB)')).not.toBeInTheDocument()

    // Meanwhile another HUB admin set it to operator; the refetch brings that.
    answerRefetch(role('operator', OPERATOR_SWITCHES, 'operator'))
    await waitFor(() =>
      expect(
        queryClient.getQueryData<RoleDetailResponse>(rolesKeys.detail(ROLE_ID))?.hub_role
      ).toBe('operator')
    )
    fireEvent.submit(document.querySelector('form#edit-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1))
    const [url, body] = mockApi.put.mock.calls[0]

    expect(url).toBe(ROLE_URL)
    expect(Object.keys(body as object)).not.toContain('hub_role')
    expect(Object.keys(body as object)).not.toContain('chat_switches')
    expect(Object.keys(body as object)).not.toContain('home_plane')
    expect(screen.getByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('operator')
  })
})

describe('EditRoleModal - chat settings of a refetched role (chat settings flag on)', () => {
  it('saves permissions without writing back the cached chat settings the refetch replaced', async () => {
    vi.stubEnv(ROLE_CHAT_SETTINGS_FLAG, 'true')
    const { answerRefetch } = openOnCachedAdmin()
    expect(await screen.findByRole('switch', { name: 'Права керівника' })).toBeChecked()
    expect(screen.getByLabelText('Екран ролі')).toHaveValue('control')
    expect(screen.queryByLabelText(/Роль у чаті \(HUB\)/)).not.toBeInTheDocument()

    // Meanwhile another HUB admin made it an operator; the refetch brings that.
    answerRefetch(role('operator', OPERATOR_SWITCHES, 'operator'))
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Права керівника' })).not.toBeChecked()
    )
    fireEvent.submit(document.querySelector('form#edit-role-form') as HTMLFormElement)
    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1))
    const [url, body] = mockApi.put.mock.calls[0]

    expect(url).toBe(ROLE_URL)
    expect(Object.keys(body as object)).not.toContain('hub_role')
    expect(Object.keys(body as object)).not.toContain('chat_switches')
    expect(Object.keys(body as object)).not.toContain('home_plane')
    expect(screen.getByLabelText('Екран ролі')).toHaveValue('operator')
  })
})
