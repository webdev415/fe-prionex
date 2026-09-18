/**
 * Maps GET /api/v1/users/me (CurrentUserResponse) to the frontend User shape.
 * Use this everywhere auth state is updated from the backend — never hand-roll partial objects.
 */

import type { CurrentUserResponse, User } from '@/types/api'

/** Normalize login/force-login/2FA response user (snake_case or camelCase) for JWT fallback. */
export function toLoginUserFallback(loginUser: Record<string, unknown>): LoginUserFallback {
  return {
    id: Number(loginUser.id),
    username: String(loginUser.username ?? ''),
    first_name: (loginUser.first_name ?? loginUser.firstName) as string | undefined,
    last_name: (loginUser.last_name ?? loginUser.lastName) as string | undefined,
    email: loginUser.email as string | undefined,
    projects: Array.isArray(loginUser.projects) ? (loginUser.projects as number[]) : undefined,
    active_project_id: (loginUser.active_project_id ?? loginUser.activeProjectId) as
      | number
      | undefined,
    active_role_id: (loginUser.active_role_id ?? loginUser.activeRoleId) as number | undefined,
    active_role_name: (loginUser.active_role_name ?? loginUser.activeRoleName) as
      | string
      | undefined,
    permissions: Array.isArray(loginUser.permissions)
      ? (loginUser.permissions as string[])
      : undefined,
  }
}

/** Subset of login response user + JWT when /users/me is unavailable. */
export interface LoginUserFallback {
  id: number
  username: string
  first_name?: string
  last_name?: string
  email?: string
  projects?: number[]
  active_project_id?: number
  active_role_id?: number
  active_role_name?: string
  permissions?: string[]
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Build a User from the JWT (permissions, project context) when /users/me fails.
 * The login payload can supply display names when the token does not include them.
 */
export function buildUserFromJwtToken(token: string, loginUser?: LoginUserFallback): User {
  const payload = parseJwtPayload(token)
  const permissions = loginUser?.permissions?.length
    ? loginUser.permissions
    : Array.isArray(payload?.permissions)
      ? (payload.permissions as string[])
      : []

  const projectIds =
    loginUser?.projects ??
    (Array.isArray(payload?.project_ids) ? (payload.project_ids as number[]) : [])

  const activeProjectId =
    loginUser?.active_project_id ?? (payload?.active_project_id as number | undefined)
  const activeRoleId = loginUser?.active_role_id ?? (payload?.active_role_id as number | undefined)
  const activeRoleName =
    loginUser?.active_role_name ?? (payload?.active_role_name as string | undefined)

  const firstName = loginUser?.first_name
  const lastName = loginUser?.last_name

  const projects = projectIds.map((projectId) => ({
    id: String(projectId),
    name: '',
    roles: [
      {
        id: String(activeRoleId ?? projectId),
        name: activeRoleName || '',
      },
    ],
  }))

  return {
    id: String(loginUser?.id ?? payload?.user_id ?? ''),
    username: String(loginUser?.username ?? payload?.username ?? ''),
    email: loginUser?.email,
    firstName,
    lastName,
    projects,
    active_project_id: activeProjectId != null ? String(activeProjectId) : null,
    active_role_id: activeRoleId != null ? String(activeRoleId) : null,
    active_role_name: activeRoleName || null,
    active_department_id:
      payload?.active_department_id != null && payload.active_department_id !== ''
        ? Number(payload.active_department_id)
        : null,
    active_group_id:
      payload?.active_group_id != null && payload.active_group_id !== ''
        ? Number(payload.active_group_id)
        : null,
    permissions,
    is_agent: false,
    agent_status: 'offline',
    mustChangePassword: false,
    twoFactorEnabled: false,
  }
}

export function mapBackendUserToUser(backendUser: CurrentUserResponse): User {
  return {
    id: String(backendUser.id),
    username: backendUser.username,
    email: backendUser.email,
    firstName: backendUser.first_name,
    lastName: backendUser.last_name,
    fullName: backendUser.full_name || undefined,
    projects:
      backendUser.projects?.map((p) => ({
        id: String(p.id),
        name: p.name,
        code: p.code,
        currency: p.currency,
        country: p.country,
        roles: [{ id: String(p.id), name: p.role_name }],
      })) || [],
    active_project_id: backendUser.active_project ? String(backendUser.active_project.id) : null,
    active_role_id: backendUser.role ? String(backendUser.role.id) : null,
    active_role_name: backendUser.role?.name || null,
    active_department_id: backendUser.department_id ?? null,
    active_department_name: backendUser.department_name ?? null,
    active_group_id: backendUser.group_id ?? null,
    active_group_name: backendUser.group_name ?? null,
    permissions: backendUser.permissions || [],
    createdAt: backendUser.created_at,
    updatedAt: backendUser.created_at,
    asterisk_extension: backendUser.asterisk_extension,
    dialer_extension: backendUser.dialer_extension,
    is_agent: backendUser.is_agent ?? false,
    agent_status: backendUser.agent_status ?? 'offline',
    avatar_url: backendUser.avatar_url ?? null,
    work_format: backendUser.work_format ?? null,
    timezone: backendUser.timezone,
    language: backendUser.language,
    themeBase: backendUser.theme_base,
    themeAccent: backendUser.theme_accent,
    mustChangePassword: backendUser.must_change_password ?? false,
    twoFactorEnabled: backendUser.two_factor_enabled ?? false,
  }
}

export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return 'User'
  // Prefer first + last (UI order); backend full_name is often "Last First".
  if (user.firstName?.trim() && user.lastName?.trim()) {
    return `${user.firstName.trim()} ${user.lastName.trim()}`
  }
  if (user.firstName?.trim()) return user.firstName.trim()
  if (user.lastName?.trim()) return user.lastName.trim()
  if (user.fullName?.trim()) return user.fullName.trim()
  return user.username || 'User'
}

/** Merge GET /users/me/projects into auth user (project names, roles, permissions). */
export function mergeUserFromProjectsResponse(
  user: User,
  data: {
    projects: Array<{
      project_id: number
      project_name: string
      project_code: string
      role_id: number
      role_name: string
      permissions?: string[]
      is_active?: boolean
      currency?: string
      country?: string
    }>
    active_project_id?: number
  }
): User {
  if (!data.projects?.length) return user

  const projects = data.projects.map((p) => ({
    id: String(p.project_id),
    name: p.project_name,
    code: p.project_code,
    currency: p.currency,
    country: p.country,
    roles: [{ id: String(p.role_id), name: p.role_name }],
  }))

  const active =
    data.projects.find((p) => p.is_active) ??
    data.projects.find((p) => p.project_id === data.active_project_id) ??
    data.projects[0]

  return {
    ...user,
    projects,
    active_project_id: active ? String(active.project_id) : user.active_project_id,
    active_role_id: active ? String(active.role_id) : user.active_role_id,
    active_role_name: active?.role_name ?? user.active_role_name,
    permissions:
      active?.permissions && active.permissions.length > 0 ? active.permissions : user.permissions,
  }
}
