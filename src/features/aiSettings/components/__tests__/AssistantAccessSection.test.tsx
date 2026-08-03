/**
 * AssistantAccessSection tests — per-role assistant access toggle.
 *
 * The roles API layer is mocked (both the named exports the component
 * imports directly and the `rolesApi` object the roles hooks call through),
 * the roles hooks (usePermissions/useRole/useUpdateRole) are real — the
 * click must reach the PUT through the real mutation. PermissionGuard is
 * driven via the @/hooks mock; the i18n mock in src/test/setup.ts returns
 * raw keys for anything not in its map, so assertions use keys.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AssistantAccessSection } from '../AssistantAccessSection'
import { useHasPermission } from '@/hooks'
import type {
  PermissionsResponse,
  RoleDetailResponse,
  RoleListResponse,
} from '@/features/roles/types'

const { mockGetRoles, mockGetRole, mockUpdateRole, mockGetPermissions } = vi.hoisted(() => ({
  mockGetRoles: vi.fn(),
  mockGetRole: vi.fn(),
  mockUpdateRole: vi.fn(),
  mockGetPermissions: vi.fn(),
}))

vi.mock('@/features/roles/api/rolesApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/roles/api/rolesApi')>()
  return {
    ...original,
    getRoles: mockGetRoles,
    getRole: mockGetRole,
    updateRole: mockUpdateRole,
    getPermissions: mockGetPermissions,
    rolesApi: {
      ...original.rolesApi,
      getRoles: mockGetRoles,
      getRole: mockGetRole,
      updateRole: mockUpdateRole,
      getPermissions: mockGetPermissions,
    },
  }
})

vi.mock('@/hooks', () => ({
  useHasPermission: vi.fn(),
  useHasAnyPermission: vi.fn(() => false),
  useHasAllPermissions: vi.fn(() => false),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockUseHasPermission = vi.mocked(useHasPermission)

const AI_PERMISSION: PermissionsResponse['permissions'][number] = {
  id: 1,
  code: 'use_ai_assistant',
  name: 'Use AI Assistant',
  category: 'AI Assistant',
}

const ROLES: RoleListResponse = {
  roles: [
    {
      id: 10,
      project_id: 1,
      name: 'Operator',
      is_default: true,
      is_active: true,
      permission_count: 2,
      user_count: 5,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 20,
      project_id: 1,
      name: 'Supervisor',
      is_default: true,
      is_active: true,
      permission_count: 2,
      user_count: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
  pagination: { page: 1, page_size: 100, total_count: 2, total_pages: 1 },
}

// Operator already has the ai permission + a tab-access permission with a
// non-default stored depth — the toggle-off must keep that depth untouched.
const OPERATOR_DETAIL: RoleDetailResponse = {
  id: 10,
  project_id: 1,
  name: 'Operator',
  is_default: true,
  is_active: true,
  permission_count: 2,
  user_count: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  permissions: [
    AI_PERMISSION,
    {
      id: 2,
      code: 'view_call_list',
      name: 'view_call_list',
      category: 'Call',
      access_level: 'department',
    },
  ],
}

// Supervisor lacks the ai permission and has a tab-access permission with no
// stored depth (access_level undefined) — the toggle-on must fill in the
// default depth rather than dropping it.
const SUPERVISOR_DETAIL: RoleDetailResponse = {
  id: 20,
  project_id: 1,
  name: 'Supervisor',
  is_default: true,
  is_active: true,
  permission_count: 2,
  user_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  permissions: [
    { id: 3, code: 'view_clients', name: 'view_clients', category: 'Clients' },
    { id: 4, code: 'view_task_history', name: 'view_task_history', category: 'Tasks' },
  ],
}

const PERMISSIONS_RESPONSE: PermissionsResponse = {
  permissions: [AI_PERMISSION],
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantAccessSection />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockGetRoles.mockReset()
  mockGetRole.mockReset()
  mockUpdateRole.mockReset()
  mockGetPermissions.mockReset()
  mockUseHasPermission.mockReset()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()

  mockUseHasPermission.mockReturnValue(true)
  mockGetRoles.mockResolvedValue(ROLES)
  mockGetPermissions.mockResolvedValue(PERMISSIONS_RESPONSE)
  mockGetRole.mockImplementation((roleId: number) =>
    Promise.resolve(roleId === 10 ? OPERATOR_DETAIL : SUPERVISOR_DETAIL)
  )
})

describe('AssistantAccessSection', () => {
  it('stays hidden without the manage_roles permission', () => {
    mockUseHasPermission.mockReturnValue(false)
    renderSection()
    expect(screen.queryByTestId('assistant-access-section')).not.toBeInTheDocument()
  })

  it('renders one row per active role, checked to the use_ai_assistant permission', async () => {
    renderSection()

    expect(screen.getByText('pages.aiSettings.accessTitle')).toBeInTheDocument()
    expect(await screen.findByText('Operator')).toBeInTheDocument()
    expect(await screen.findByText('Supervisor')).toBeInTheDocument()

    const switches = await screen.findAllByRole('switch')
    expect(switches).toHaveLength(2)
    await waitFor(() => expect(switches[0]).toHaveAttribute('aria-checked', 'true')) // Operator
    await waitFor(() => expect(switches[1]).toHaveAttribute('aria-checked', 'false')) // Supervisor
  })

  it('toggling off removes only the ai permission and preserves stored access_levels', async () => {
    mockUpdateRole.mockResolvedValue(OPERATOR_DETAIL)
    renderSection()

    const switches = await screen.findAllByRole('switch')
    await waitFor(() => expect(switches[0]).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(switches[0])

    await waitFor(() =>
      expect(mockUpdateRole).toHaveBeenCalledWith(10, {
        permission_ids: [2],
        access_levels: { 2: 'department' },
      })
    )
    // No per-row toast here — useUpdateRole's own generic success toast is
    // the only one that fires (avoids the double-toast the review caught).
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Role updated successfully'))
  })

  it('toggling on adds the ai permission and fills default access_levels for tab permissions', async () => {
    mockUpdateRole.mockResolvedValue(SUPERVISOR_DETAIL)
    renderSection()

    const switches = await screen.findAllByRole('switch')
    await waitFor(() => expect(switches[1]).toHaveAttribute('aria-checked', 'false'))
    fireEvent.click(switches[1])

    await waitFor(() =>
      expect(mockUpdateRole).toHaveBeenCalledWith(20, {
        permission_ids: [3, 4, 1],
        access_levels: { 4: 'all' },
      })
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Role updated successfully'))
  })

  it('keeps the switch checked and lets the hook toast the error when the PUT fails', async () => {
    mockUpdateRole.mockRejectedValue(new Error('403'))
    renderSection()

    const switches = await screen.findAllByRole('switch')
    await waitFor(() => expect(switches[0]).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(switches[0])

    await waitFor(() => expect(mockUpdateRole).toHaveBeenCalled())
    // useUpdateRole's own onError toasts getErrorMessage(error) — the row
    // adds nothing on top, it only swallows the rejection.
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('403'))
    // Role detail is unchanged (the PUT never landed), so the switch never
    // moves away from its pre-toggle state.
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
  })
})
