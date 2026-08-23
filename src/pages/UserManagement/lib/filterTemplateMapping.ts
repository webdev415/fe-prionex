import type { FilterTemplateValue, UserSearchField, UserSortOrder } from '@/features/users/types'
import {
  ALL_FILTER_VALUE,
  DEFAULT_USER_FILTERS,
  DEFAULT_WORK_FORMAT_FILTER,
  type UserFilterState,
  type WorkFormatFilter,
} from './userFilterDefaults'

export interface TemplateExtras {
  search: string
  searchField: UserSearchField
  pageSize: number
}

export type TemplateDocument = Record<string, FilterTemplateValue>

const WORK_FORMATS: WorkFormatFilter[] = ['all', 'office', 'remote']

export function filterStateToTemplate(
  filters: UserFilterState,
  extras: TemplateExtras
): TemplateDocument {
  const document: TemplateDocument = {}

  if (filters.roleId !== ALL_FILTER_VALUE) document.role_id = filters.roleId
  if (filters.projectId !== ALL_FILTER_VALUE) document.project_id = filters.projectId
  if (filters.departmentId !== ALL_FILTER_VALUE) document.department_id = filters.departmentId
  if (filters.groupId !== ALL_FILTER_VALUE) document.group_id = filters.groupId
  if (filters.workFormat !== DEFAULT_WORK_FORMAT_FILTER) document.work_format = filters.workFormat
  if (filters.statusFilter !== DEFAULT_USER_FILTERS.statusFilter) {
    document.status = filters.statusFilter
  }
  if (filters.sortBy !== DEFAULT_USER_FILTERS.sortBy) document.sort_by = filters.sortBy
  if (filters.sortOrder !== DEFAULT_USER_FILTERS.sortOrder) document.sort_order = filters.sortOrder

  const search = extras.search.trim()
  if (search) {
    document.search = search
    document.search_field = extras.searchField
  }
  document.page_size = extras.pageSize

  return document
}

function asNumber(value: FilterTemplateValue, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function templateToFilterState(document: TemplateDocument): UserFilterState {
  const workFormat = document.work_format
  const status = document.status
  const sortBy = document.sort_by
  const sortOrder = document.sort_order

  return {
    roleId: asNumber(document.role_id, ALL_FILTER_VALUE),
    projectId: asNumber(document.project_id, ALL_FILTER_VALUE),
    departmentId: asNumber(document.department_id, ALL_FILTER_VALUE),
    groupId: asNumber(document.group_id, ALL_FILTER_VALUE),
    workFormat: WORK_FORMATS.includes(workFormat as WorkFormatFilter)
      ? (workFormat as WorkFormatFilter)
      : DEFAULT_WORK_FORMAT_FILTER,
    statusFilter:
      status === 'active' || status === 'disabled' || status === 'all'
        ? (status as UserFilterState['statusFilter'])
        : DEFAULT_USER_FILTERS.statusFilter,
    sortBy:
      typeof sortBy === 'string'
        ? (sortBy as UserFilterState['sortBy'])
        : DEFAULT_USER_FILTERS.sortBy,
    sortOrder:
      sortOrder === 'asc' || sortOrder === 'desc'
        ? (sortOrder as UserSortOrder)
        : DEFAULT_USER_FILTERS.sortOrder,
  }
}

export function templateToExtras(
  document: TemplateDocument,
  fallback: TemplateExtras
): TemplateExtras {
  const search = typeof document.search === 'string' ? document.search : ''
  const searchField = document.search_field
  return {
    search,
    searchField:
      typeof searchField === 'string' ? (searchField as UserSearchField) : fallback.searchField,
    pageSize: asNumber(document.page_size, fallback.pageSize),
  }
}
