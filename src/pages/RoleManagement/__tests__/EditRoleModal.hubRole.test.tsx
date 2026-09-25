/**
 * EditRoleModal on the path a stale role detail really takes (KAN-1476).
 *
 * The modal renders the cached role detail at once and refetches it in the
 * background; the refetch hands the open form a new `role`. When another HUB
 * admin changed the role's HUB chat role in between, a save of permissions
 * only must not write the cached HUB role back - that would silently grant
 * HUB admin again.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { HubRoleCatalog, RoleDetailResponse } from '@/features/roles/types'

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))

vi.mock('@/lib/api', () => ({ api: mockApi, default: mockApi }))

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
const { rolesKeys } = await import('@/features/roles/hooks/useRoles')
const { projectsKeys } = await import('@/features/projects/hooks/useProjects')

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
}

function role(hubRole: string | null): RoleDetailResponse {
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
  }
}

beforeEach(() => {
  mockApi.get.mockReset()
  mockApi.put.mockReset()
  mockApi.put.mockResolvedValue({ data: role('operator') })
})

describe('EditRoleModal - HUB chat role of a refetched role', () => {
  it('saves permissions without writing back the cached HUB role the refetch replaced', async () => {
    let answerRefetch: (detail: RoleDetailResponse) => void = () => undefined
    mockApi.get.mockImplementation(async (url: string) => {
      if (url === ROLE_URL) {
        // Held until the form is on screen with the cached detail.
        return new Promise((resolve) => {
          answerRefetch = (detail) => resolve({ data: detail })
        })
      }
      if (url === '/api/v1/admin/roles/hub-roles') return { data: hubAdminCatalog }
      if (url === `/api/v1/projects/${PROJECT}`) return { data: { id: PROJECT, name: 'Техно' } }
      if (url === '/api/v1/admin/permissions') {
        return {
          data: {
            permissions: [
              { id: 1, code: 'view_clients', name: 'view_clients', category: 'Clients' },
            ],
          },
        }
      }
      throw new Error(`unexpected GET ${url}`)
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    // Opened View a while ago: the detail, admin in HUB, is in the cache.
    queryClient.setQueryData(rolesKeys.detail(ROLE_ID), role('admin'))
    queryClient.setQueryData(projectsKeys.detail(PROJECT), { id: PROJECT, name: 'Техно' })

    render(
      <QueryClientProvider client={queryClient}>
        <EditRoleModal open roleId={ROLE_ID} onClose={vi.fn()} onSuccess={vi.fn()} />
      </QueryClientProvider>
    )
    expect(await screen.findByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('admin')

    // Meanwhile another HUB admin set it to operator; the refetch brings that.
    answerRefetch(role('operator'))
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
    expect(screen.getByLabelText(/Роль у чаті \(HUB\)/)).toHaveValue('operator')
  })
})
