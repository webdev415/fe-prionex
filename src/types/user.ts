/**
 * User Management Types
 *
 * Type definitions for the User Management Dashboard system.
 * Includes user data models, roles, statuses, and related interfaces.
 */

/**
 * User role types in the system
 */
export type UserRole = 'Admin' | 'Supervisor' | 'Operator'

/**
 * User account status types
 */
export type UserStatus = 'Active' | 'Disabled'

/**
 * Project entity that users can be assigned to
 */
export interface Project {
  /** Unique project identifier */
  id: string
  /** Human-readable project name */
  name: string
  /** URL-friendly project slug */
  slug: string
}

/**
 * Main User entity
 *
 * Represents a system user with their role, assigned projects, and status.
 */
export interface User {
  /** Unique user identifier */
  id: string
  /** User's full name */
  username: string
  /** User's email address */
  email: string
  /** User's phone number in E.164 format (e.g., +1-555-0101) */
  phoneNumber: string
  /** User's role in the system */
  role: UserRole
  /** Projects assigned to this user, or 'all' for admin access */
  projects: Project[] | 'all'
  /** Current account status */
  status: UserStatus
  /** ISO 8601 timestamp when user was created */
  createdAt: string
  /** ISO 8601 timestamp of last login, or null if never logged in */
  lastLogin: string | null
}

/**
 * Table column configuration
 */
export interface UserTableColumn {
  /** Column data key from User interface */
  key: keyof User
  /** Column header label */
  label: string
  /** Whether this column is sortable */
  sortable: boolean
  /** Optional custom render function */
  render?: (user: User) => React.ReactNode
}

/**
 * Pagination component props
 */
export interface PaginationProps {
  /** Current active page (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Callback when page changes */
  onPageChange: (page: number) => void
}

/**
 * Search filter types
 */
export type SearchFilter = 'phone' | 'email' | 'username' | 'role' | 'project'

/**
 * SearchBar component props
 */
export interface SearchBarProps {
  /** Current search query value */
  value: string
  /** Active filter type */
  filterBy: SearchFilter
  /** Callback when search is triggered */
  onSearch: (query: string, filter: SearchFilter) => void
  /** Callback when search is cleared */
  onClear: () => void
}
