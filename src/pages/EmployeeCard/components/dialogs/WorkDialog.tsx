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
    card.work.department_id ? String(card.work.department_id) : ''
  )
  const [roleId, setRoleId] = useState<string>(card.work.role_id ? String(card.work.role_id) : '')
  const [managerId, setManagerId] = useState<string>(
    card.header.manager_user_id ? String(card.header.manager_user_id) : NOBODY
  )
  const [hiredAt, setHiredAt] = useState<string>(card.work.hired_at ?? '')

  const roles = useMemo(() => rolesData?.roles ?? [], [rolesData?.roles])
  const positions = useMemo(
    () =>
      departmentId
        ? roles.filter((role) => String(role.department_id ?? '') === departmentId)
        : roles,
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
            ...(departmentId ? { department_id: Number(departmentId) } : {}),
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
              {(departmentsData?.departments ?? []).map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>
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
          <span className="text-muted-foreground text-xs">
            {t('pages.employeeCard.fields.manager')}
          </span>
          <Select value={managerId} onValueChange={setManagerId}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.employeeCard.dialogs.choose')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOBODY}>{t('pages.employeeCard.dialogs.noManager')}</SelectItem>
              {(peopleData?.users ?? [])
                .filter((person) => person.id !== card.header.id)
                .map((person) => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.full_name || person.username}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
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
