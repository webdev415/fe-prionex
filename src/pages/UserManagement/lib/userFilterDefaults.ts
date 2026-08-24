import type { UserSortField, UserSortOrder, UserStatusFilter } from '@/features/users/types'

export const DEFAULT_USER_STATUS_FILTER: UserStatusFilter = 'active'
export const DEFAULT_USER_SORT_BY: UserSortField = 'id'
export const DEFAULT_USER_SORT_ORDER: UserSortOrder = 'desc'

/** Numeric filter sentinel: 0 means "All" (no filter sent to API). */
export const ALL_FILTER_VALUE = 0

export type WorkFormatFilter = 'all' | 'office' | 'remote'

export const DEFAULT_WORK_FORMAT_FILTER: WorkFormatFilter = 'all'

export interface UserFilterState {
  roleId: number
  projectId: number
  departmentIds: number[]
  groupId: number
  workFormat: WorkFormatFilter
  statusFilter: UserStatusFilter
  sortBy: UserSortField
  sortOrder: UserSortOrder
}

export const DEFAULT_USER_FILTERS: UserFilterState = {
  roleId: ALL_FILTER_VALUE,
  projectId: ALL_FILTER_VALUE,
  departmentIds: [],
  groupId: ALL_FILTER_VALUE,
  workFormat: DEFAULT_WORK_FORMAT_FILTER,
  statusFilter: DEFAULT_USER_STATUS_FILTER,
  sortBy: DEFAULT_USER_SORT_BY,
  sortOrder: DEFAULT_USER_SORT_ORDER,
}

const LEGACY_STATUS_FILTERS: Record<string, UserStatusFilter> = { disabled: 'inactive' }

export const USER_STATUS_FILTERS: UserStatusFilter[] = ['all', 'active', 'inactive']

/**
 * Read a status filter that may have been written before the control and the
 * endpoint agreed on their words. A bookmarked ?status=disabled and a template
 * saved under the old spelling both still mean inactive.
 */
export function asStatusFilter(value: unknown): UserStatusFilter {
  if (typeof value !== 'string') return DEFAULT_USER_STATUS_FILTER
  const migrated = LEGACY_STATUS_FILTERS[value] ?? value
  return USER_STATUS_FILTERS.includes(migrated as UserStatusFilter)
    ? (migrated as UserStatusFilter)
    : DEFAULT_USER_STATUS_FILTER
}

export function statusFilterToApiStatus(
  statusFilter: UserStatusFilter
): 'active' | 'inactive' | undefined {
  return statusFilter === 'all' ? undefined : statusFilter
}

export function isUserFilterActive(
  key: keyof Pick<
    UserFilterState,
    'roleId' | 'projectId' | 'departmentIds' | 'groupId' | 'workFormat' | 'statusFilter'
  >,
  value: UserFilterState[keyof UserFilterState]
): boolean {
  if (key === 'departmentIds') {
    return Array.isArray(value) && value.length > 0
  }
  if (key === 'statusFilter') {
    return value !== DEFAULT_USER_STATUS_FILTER
  }
  if (key === 'workFormat') {
    return value !== DEFAULT_WORK_FORMAT_FILTER
  }
  return value !== ALL_FILTER_VALUE
}

export function workFormatToApiValue(
  workFormat: WorkFormatFilter
): 'office' | 'remote' | undefined {
  return workFormat === 'all' ? undefined : workFormat
}

export function parseDepartmentIds(raw: unknown): number[] {
  const isUsable = (value: number) => Number.isFinite(value) && value > 0

  if (Array.isArray(raw)) {
    return raw.map((value) => Number(value)).filter(isUsable)
  }
  if (typeof raw === 'number') {
    return isUsable(raw) ? [raw] : []
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(isUsable)
  }
  return []
}
