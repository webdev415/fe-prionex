import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateSelect } from '@/components/ui/DateSelect'
import '@/components/ui/DateSelect.theme.css'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useDepartments } from '@/features/departments'
import { useUpdateWork } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { useRoles } from '@/features/roles'
import { useUsers } from '@/features/users/hooks/useUsers'
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'
import { SectionDialog } from './SectionDialog'
import { useSectionSave } from './useSectionSave'

export interface WorkDialogProps {
  card: EmployeeCard
  projectId: number | null
  open: boolean
  onClose: () => void
}

const FORM_ID = 'employee-card-work'
const NOBODY = 'none'
const MANAGER_FIELD = 'employee-card-manager'

/**
 * The Personnel Data dialog.
 *
 * Position and department are not independent: a role already belongs to a
 * department, so choosing a department narrows the positions rather than
 * standing beside them. Offering both freely is what lets somebody pick a
 * pair that describes nothing, which the server then has to refuse.
 *
 * Changing a position here goes the same way the user-management screen sends
 * it, so assignments are reconciled and the move reaches the chronology once.
 */
export function WorkDialog({ card, projectId, open, onClose }: WorkDialogProps) {
  const { t } = useTranslation()
  const mutation = useUpdateWork(card.header.id, projectId)
  const { save, error, saving } = useSectionSave(mutation, onClose)

  const { data: departmentsData } = useDepartments({
    page: 1,
    page_size: 100,
    is_active: true,
  })
  const { data: rolesData } = useRoles({ page: 1, page_size: 100, is_active: true })
  const { data: peopleData } = useUsers({ page: 1, page_size: 100, status: 'active' })

  const [departmentId, setDepartmentId] = useState<string>(
    card.work.department_id ? String(card.work.department_id) : NOBODY
  )
  const [roleId, setRoleId] = useState<string>(card.work.role_id ? String(card.work.role_id) : '')
  const [managerId, setManagerId] = useState<string>(
    card.header.manager_user_id ? String(card.header.manager_user_id) : NOBODY
  )
  const [hiredAt, setHiredAt] = useState<string>(card.work.hired_at ?? '')

  const roles = useMemo(() => rolesData?.roles ?? [], [rolesData?.roles])
  /*
   * Nobody is an option, and it heads the list rather than being buried among
   * the names: removing a manager is a thing somebody comes here to do.
   */
  const managers = useMemo(
    () => [
      { id: NOBODY, name: t('pages.employeeCard.dialogs.noManager') },
      ...(peopleData?.users ?? [])
        .filter((person) => person.id !== card.header.id)
        .map((person) => ({
          id: String(person.id),
          name: person.full_name || person.username,
        })),
    ],
    [peopleData, card.header.id, t]
  )

  /*
   * The department is not a field on the employee - it follows from their
   * role, and the server only reads it here to check the two agree. What this
   * select really does is narrow the list of positions below it.
   *
   * So "no department" heads the list as the roles that belong to no
   * department: Admin, collector, manager and the rest, 25 of the 39 roles
   * here. Leaving it out stranded anybody holding one of them, because no
   * department could be chosen that would list their own position.
   */
  const departments = useMemo(
    () => [
      { id: NOBODY, name: t('pages.employeeCard.dialogs.noDepartment') },
      ...(departmentsData?.departments ?? []).map((department) => ({
        id: String(department.id),
        name: department.name,
      })),
    ],
    [departmentsData, t]
  )

  const positions = useMemo(
    () =>
      departmentId === NOBODY
        ? roles.filter((role) => role.department_id == null)
        : roles.filter((role) => String(role.department_id ?? '') === departmentId),
    [roles, departmentId]
  )

  return (
    <SectionDialog
      open={open}
      title={t('pages.employeeCard.dialogs.work')}
      formId={FORM_ID}
      saving={saving}
      error={error}
      onClose={onClose}
    >
      <form
        id={FORM_ID}
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          void save({
            ...(projectId ? { project_id: projectId } : {}),
            ...(roleId ? { role_id: Number(roleId) } : {}),
            ...(departmentId === NOBODY ? {} : { department_id: Number(departmentId) }),
            manager_user_id: managerId === NOBODY ? null : Number(managerId),
            hired_at: hiredAt || null,
          })
        }}
      >
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {t('pages.employeeCard.fields.department')}
          </span>
          <Select
            value={departmentId}
            onValueChange={(value) => {
              setDepartmentId(value)
              setRoleId('')
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('pages.employeeCard.dialogs.choose')} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {t('pages.employeeCard.fields.position')}
          </span>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.employeeCard.dialogs.choose')} />
            </SelectTrigger>
            <SelectContent>
              {positions.map((role) => (
                <SelectItem key={role.id} value={String(role.id)}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          {/* A real label, not a span beside it: the picker is a button rather
              than a native select, so without one it has no accessible name at
              all - a screen reader would announce whichever name happens to be
              chosen and nothing about what it is choosing. */}
          <label htmlFor={MANAGER_FIELD} className="text-muted-foreground block text-xs">
            {t('pages.employeeCard.fields.manager')}
          </label>
          {/*
            Searchable, unlike the two above it. Department and position are
            short lists somebody can read; every employee is not, and picking a
            manager out of it by scrolling means knowing where in the order
            they fall. The names are already loaded, so the filtering is local.
          */}
          <SearchableSelect
            id={MANAGER_FIELD}
            options={managers}
            value={managerId}
            onValueChange={setManagerId}
            placeholder={t('pages.employeeCard.dialogs.choose')}
            searchPlaceholder={t('pages.employeeCard.dialogs.searchManager')}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {t('pages.employeeCard.fields.hiredAt')}
          </span>
          <DateSelect
            value={parsePickerYMD(hiredAt)}
            onChange={({ value }) => setHiredAt(value ? formatPickerDateAsYMD(value) : '')}
            format="dd.MM.yyyy"
            allowManualInput
            placeholder={t('pages.employeeCard.fields.hiredAt')}
          />
        </div>
      </form>
    </SectionDialog>
  )
}
