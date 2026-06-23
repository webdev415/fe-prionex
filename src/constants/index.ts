/**
 * Application Constants
 *
 * Centralized constants to avoid magic numbers and strings throughout the codebase.
 */

/**
 * Pagination Constants
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const

/**
 * Query Constants
 */
export const QUERY = {
  STALE_TIME: 1000 * 60 * 5, // 5 minutes
  CACHE_TIME: 1000 * 60 * 30, // 30 minutes
  RETRY_COUNT: 1,
} as const

/**
 * Application Routes
 */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  CLIENT: '/dashboard/client',
  USERS: '/dashboard/team-management/users',
  PROJECTS: '/dashboard/projects',
  ROLES: '/dashboard/team-management/roles',
} as const

/**
 * Session Constants
 *
 * SESSION_TTL_SECONDS mirrors the backend `SESSION_TTL_SECONDS` (KAN-759:
 * 2-hour sliding window in Redis). The frontend uses it only to schedule a
 * single /auth/validate heartbeat after an idle stretch — see
 * `src/lib/sessionHeartbeat.ts`. If the backend value changes, update both;
 * a temporary divergence is safe (early heartbeat = one extra validate ping
 * per stretch, no user-visible regression).
 */
export const SESSION = {
  TOKEN_KEY: 'prionex_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
  SESSION_TTL_SECONDS: 7200,
} as const

/**
 * Re-export permissions from permissions module
 */
export { PERMISSIONS, type Permission } from './permissions'
