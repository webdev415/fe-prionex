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
import { CheckboxMultiSelect } from '@/components/ui/CheckboxMultiSelect'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
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
  search?: ReactNode
  actions?: ReactNode
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
          className={cn('h-[45px] w-full', isActive && 'border-primary bg-primary/10')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

interface AppliedChip {
  key: string
  label: string
  onClear: () => void
}

function AppliedFilterChips({
  chips,
  clearLabel,
  onReset,
  actions,
}: {
  chips: AppliedChip[]
  clearLabel: string
  onReset: () => void
  actions?: ReactNode
}) {
  if (chips.length === 0 && !actions) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="bg-card text-foreground border-border flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
          >
            {chip.label}
            <button
              type="button"
              onClick={chip.onClear}
              aria-label={chip.label}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Icons.Cancel01 size={12} strokeWidth={2} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {chips.length > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-sm underline-offset-2 hover:underline"
          >
            <Icons.CancelCircle size={14} strokeWidth={1.5} />
            {clearLabel}
          </button>
        )}
        {actions}
      </div>
    </div>
  )
}

export function UserFiltersBar({
  filters,
  onFilterChange,
  onReset,
  search,
  actions,
}: UserFiltersBarProps) {
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

  const departmentSelected = filters.departmentIds.length === 1

  const { data: groupsData } = useGroups(
    {
      department_id: departmentSelected ? filters.departmentIds[0] : undefined,
      page: 1,
      page_size: 100,
      is_active: true,
    },
    departmentSelected
  )

  const departmentOptions = useMemo(
    () =>
      departments.map((department) => {
        const projectName = projectNameById.get(department.project_id)
        return {
          value: department.id,
          label: projectName ? `${department.name} (${projectName})` : department.name,
        }
      }),
    [departments, projectNameById]
  )

  const groups = useMemo(() => {
    const items = groupsData?.groups ?? []
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  }, [groupsData?.groups])

  const handleDepartmentChange = (next: number[]) => {
    onFilterChange({
      departmentIds: next,
      groupId: ALL_FILTER_VALUE,
    })
  }

  const appliedChips = useMemo(() => {
    const chips: AppliedChip[] = []
    if (isUserFilterActive('projectId', filters.projectId)) {
      chips.push({
        key: 'project',
        label: `${t('pages.users.filters.project')}: ${projectNameById.get(filters.projectId) ?? filters.projectId}`,
        onClear: () =>
          onFilterChange({
            projectId: ALL_FILTER_VALUE,
            departmentIds: [],
            groupId: ALL_FILTER_VALUE,
          }),
      })
    }
    if (isUserFilterActive('roleId', filters.roleId)) {
      chips.push({
        key: 'role',
        label: `${t('pages.users.filters.role')}: ${roles.find((r) => r.id === filters.roleId)?.name ?? filters.roleId}`,
        onClear: () => onFilterChange({ roleId: ALL_FILTER_VALUE }),
      })
    }
    for (const departmentId of filters.departmentIds) {
      chips.push({
        key: `department-${departmentId}`,
        label: `${t('pages.users.filters.department')}: ${departments.find((d) => d.id === departmentId)?.name ?? departmentId}`,
        onClear: () =>
          onFilterChange({
            departmentIds: filters.departmentIds.filter((id) => id !== departmentId),
            groupId: ALL_FILTER_VALUE,
          }),
      })
    }
    if (isUserFilterActive('groupId', filters.groupId)) {
      chips.push({
        key: 'group',
        label: `${t('pages.users.filters.group')}: ${groups.find((g) => g.id === filters.groupId)?.name ?? filters.groupId}`,
        onClear: () => onFilterChange({ groupId: ALL_FILTER_VALUE }),
      })
    }
    if (isUserFilterActive('workFormat', filters.workFormat)) {
      chips.push({
        key: 'workFormat',
        label: `${t('pages.users.filters.workFormat')}: ${t(`pages.profileSettings.workFormat.${filters.workFormat}`)}`,
        onClear: () => onFilterChange({ workFormat: DEFAULT_USER_FILTERS.workFormat }),
      })
    }
    if (isUserFilterActive('statusFilter', filters.statusFilter)) {
      chips.push({
        key: 'status',
        label: `${t('pages.users.filters.status')}: ${t(`pages.users.filters.statusOptions.${filters.statusFilter}`)}`,
        onClear: () => onFilterChange({ statusFilter: DEFAULT_USER_FILTERS.statusFilter }),
      })
    }
    return chips
  }, [filters, projectNameById, roles, departments, groups, onFilterChange, t])

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

        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <span className="text-foreground text-sm font-medium">
            {t('pages.users.filters.department')}
          </span>
          <CheckboxMultiSelect
            options={departmentOptions}
            selected={filters.departmentIds}
            onChange={handleDepartmentChange}
            allLabel={t('pages.users.filters.all')}
            ariaLabel={t('pages.users.filters.department')}
            className={cn(
              isUserFilterActive('departmentIds', filters.departmentIds) && 'border-primary-500'
            )}
          />
        </div>

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
      </div>

      {search}

      <AppliedFilterChips
        chips={appliedChips}
        clearLabel={t('pages.users.filters.clearFilters')}
        onReset={onReset}
        actions={actions}
      />
    </div>
  )
}
