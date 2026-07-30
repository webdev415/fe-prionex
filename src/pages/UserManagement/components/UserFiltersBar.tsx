/**
 * UserFiltersBar Component
 *
 * Row of single-select filters above the users table.
 */

import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoles } from '@/features/roles'
import { useProjects } from '@/features/projects'
import { useDepartments } from '@/features/departments'
import { useGroups } from '@/features/groups'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { UserStatusFilter } from '@/features/users/types'
import {
  ALL_FILTER_VALUE,
  DEFAULT_USER_FILTERS,
  isUserFilterActive,
  type UserFilterState,
} from '../lib/userFilterDefaults'

interface UserFiltersBarProps {
  filters: UserFilterState
  onFilterChange: (next: Partial<UserFilterState>) => void
  onReset: () => void
}

interface FilterSelectProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  isActive: boolean
  disabled?: boolean
  children: ReactNode
}

function FilterSelect({
  label,
  value,
  onValueChange,
  isActive,
  disabled = false,
  children,
}: FilterSelectProps) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col gap-1.5 sm:max-w-[220px] sm:min-w-[160px]">
      <span className="text-foreground text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          className={cn('h-[45px] w-full', isActive && 'border-primary-500 bg-primary-50')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

export function UserFiltersBar({ filters, onFilterChange, onReset }: UserFiltersBarProps) {
  const { t } = useTranslation('common')

  const { data: rolesData } = useRoles({ page: 1, page_size: 100, is_active: true })
  const { data: projectsData } = useProjects({ page: 1, page_size: 100, status: 'active' })
  const { data: departmentsData } = useDepartments({
    page: 1,
    page_size: 100,
    is_active: true,
  })

  const projects = useMemo(() => projectsData?.projects ?? [], [projectsData?.projects])
  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  )

  const roles = useMemo(() => {
    const items = rolesData?.roles ?? []
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  }, [rolesData?.roles])

  const departments = useMemo(() => {
    const items = departmentsData?.departments ?? []
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  }, [departmentsData?.departments])

  const departmentSelected = filters.departmentId > ALL_FILTER_VALUE

  const { data: groupsData } = useGroups(
    {
      department_id: departmentSelected ? filters.departmentId : undefined,
      page: 1,
      page_size: 100,
      is_active: true,
    },
    departmentSelected
  )

  const groups = useMemo(() => {
    const items = groupsData?.groups ?? []
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  }, [groupsData?.groups])

  const handleDepartmentChange = (value: string) => {
    const departmentId = value === 'all' ? ALL_FILTER_VALUE : Number(value)
    onFilterChange({
      departmentId,
      groupId: ALL_FILTER_VALUE,
    })
  }

  const hasNonDefaultFilters =
    isUserFilterActive('roleId', filters.roleId) ||
    isUserFilterActive('projectId', filters.projectId) ||
    isUserFilterActive('departmentId', filters.departmentId) ||
    isUserFilterActive('groupId', filters.groupId) ||
    isUserFilterActive('statusFilter', filters.statusFilter) ||
    filters.sortBy !== DEFAULT_USER_FILTERS.sortBy ||
    filters.sortOrder !== DEFAULT_USER_FILTERS.sortOrder

  return (
    <div className="bg-filter-bar mb-4 flex w-full flex-col gap-3 rounded-xl p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label={t('pages.users.filters.role')}
          value={filters.roleId > 0 ? String(filters.roleId) : 'all'}
          onValueChange={(value) =>
            onFilterChange({
              roleId: value === 'all' ? ALL_FILTER_VALUE : Number(value),
            })
          }
          isActive={isUserFilterActive('roleId', filters.roleId)}
        >
          <SelectItem value="all">{t('pages.users.filters.all')}</SelectItem>
          {roles.map((role) => {
            const projectName = projectNameById.get(role.project_id)
            const label = projectName ? `${role.name} (${projectName})` : role.name
            return (
              <SelectItem key={role.id} value={String(role.id)}>
                {label}
              </SelectItem>
            )
          })}
        </FilterSelect>

        <FilterSelect
          label={t('pages.users.filters.project')}
          value={filters.projectId > 0 ? String(filters.projectId) : 'all'}
          onValueChange={(value) =>
            onFilterChange({
              projectId: value === 'all' ? ALL_FILTER_VALUE : Number(value),
            })
          }
          isActive={isUserFilterActive('projectId', filters.projectId)}
        >
          <SelectItem value="all">{t('pages.users.filters.all')}</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={String(project.id)}>
              {project.name}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          label={t('pages.users.filters.department')}
          value={filters.departmentId > 0 ? String(filters.departmentId) : 'all'}
          onValueChange={handleDepartmentChange}
          isActive={isUserFilterActive('departmentId', filters.departmentId)}
        >
          <SelectItem value="all">{t('pages.users.filters.all')}</SelectItem>
          {departments.map((department) => {
            const projectName = projectNameById.get(department.project_id)
            const label = projectName ? `${department.name} (${projectName})` : department.name
            return (
              <SelectItem key={department.id} value={String(department.id)}>
                {label}
              </SelectItem>
            )
          })}
        </FilterSelect>

        <FilterSelect
          label={t('pages.users.filters.group')}
          value={filters.groupId > 0 ? String(filters.groupId) : 'all'}
          onValueChange={(value) =>
            onFilterChange({
              groupId: value === 'all' ? ALL_FILTER_VALUE : Number(value),
            })
          }
          isActive={isUserFilterActive('groupId', filters.groupId)}
          disabled={!departmentSelected}
        >
          <SelectItem value="all">{t('pages.users.filters.all')}</SelectItem>
          {groups.map((group) => (
            <SelectItem key={group.id} value={String(group.id)}>
              {group.name}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          label={t('pages.users.filters.status')}
          value={filters.statusFilter}
          onValueChange={(value) => onFilterChange({ statusFilter: value as UserStatusFilter })}
          isActive={isUserFilterActive('statusFilter', filters.statusFilter)}
        >
          <SelectItem value="all">{t('pages.users.filters.statusOptions.all')}</SelectItem>
          <SelectItem value="active">{t('pages.users.filters.statusOptions.active')}</SelectItem>
          <SelectItem value="disabled">
            {t('pages.users.filters.statusOptions.disabled')}
          </SelectItem>
        </FilterSelect>

        <button
          type="button"
          onClick={onReset}
          disabled={!hasNonDefaultFilters}
          className="text-foreground hover:text-primary-700 disabled:text-muted-foreground mb-0.5 h-[45px] px-2 text-sm font-medium whitespace-nowrap underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline"
        >
          {t('pages.users.filters.resetToDefault')}
        </button>
      </div>
    </div>
  )
}
