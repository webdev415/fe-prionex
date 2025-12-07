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
  USERS: '/dashboard/users',
  PROJECTS: '/dashboard/projects',
  ROLES: '/dashboard/roles',
} as const

/**
 * Session Constants
 */
export const SESSION = {
  TOKEN_KEY: 'auth_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
} as const
