import type { UserSortField, UserSortOrder, UserStatusFilter } from '@/features/users/types'

export const DEFAULT_USER_STATUS_FILTER: UserStatusFilter = 'active'
export const DEFAULT_USER_SORT_BY: UserSortField = 'id'
export const DEFAULT_USER_SORT_ORDER: UserSortOrder = 'desc'

/** Numeric filter sentinel: 0 means "All" (no filter sent to API). */
export const ALL_FILTER_VALUE = 0

export interface UserFilterState {
  roleId: number
  projectId: number
  departmentId: number
  groupId: number
  statusFilter: UserStatusFilter
  sortBy: UserSortField
  sortOrder: UserSortOrder
}

export const DEFAULT_USER_FILTERS: UserFilterState = {
  roleId: ALL_FILTER_VALUE,
  projectId: ALL_FILTER_VALUE,
  departmentId: ALL_FILTER_VALUE,
  groupId: ALL_FILTER_VALUE,
  statusFilter: DEFAULT_USER_STATUS_FILTER,
  sortBy: DEFAULT_USER_SORT_BY,
  sortOrder: DEFAULT_USER_SORT_ORDER,
}

export function statusFilterToApiStatus(
  statusFilter: UserStatusFilter
): 'active' | 'inactive' | undefined {
  if (statusFilter === 'active') return 'active'
  if (statusFilter === 'disabled') return 'inactive'
  return undefined
}

export function isUserFilterActive(
  key: keyof Pick<
    UserFilterState,
    'roleId' | 'projectId' | 'departmentId' | 'groupId' | 'statusFilter'
  >,
  value: UserFilterState[keyof UserFilterState]
): boolean {
  if (key === 'statusFilter') {
    return value !== DEFAULT_USER_STATUS_FILTER
  }
  return value !== ALL_FILTER_VALUE
}
